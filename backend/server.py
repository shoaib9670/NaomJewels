from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import json

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'naom_jewels_secret')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Security
security = HTTPBearer(auto_error=False)

# Create the main app
app = FastAPI(title="NAOM Jewels API")

# Create router with /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class Product(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    price: float
    original_price: Optional[float] = None
    category: str
    subcategory: Optional[str] = None
    images: List[str]
    metal: str
    color: str
    stock: int = 10
    rating: float = 4.5
    reviews_count: int = 0
    is_bestseller: bool = False
    is_new: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class CartItem(BaseModel):
    product_id: str
    quantity: int = 1

class CartItemResponse(BaseModel):
    product_id: str
    quantity: int
    product: Optional[Dict[str, Any]] = None

class WishlistItem(BaseModel):
    product_id: str

class OrderCreate(BaseModel):
    items: List[CartItem]
    shipping_address: Dict[str, str]

class ChatMessage(BaseModel):
    message: str
    session_id: Optional[str] = None

class CheckoutRequest(BaseModel):
    origin_url: str

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        return None
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def require_auth(credentials: HTTPAuthorizationCredentials = Depends(security)):
    user = await get_current_user(credentials)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "email": user_data.email,
        "password": hash_password(user_data.password),
        "name": user_data.name,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user)
    
    token = create_token(user_id, user_data.email)
    return TokenResponse(
        access_token=token,
        user=UserResponse(id=user_id, email=user_data.email, name=user_data.name, created_at=user["created_at"])
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = create_token(user["id"], user["email"])
    return TokenResponse(
        access_token=token,
        user=UserResponse(id=user["id"], email=user["email"], name=user["name"], created_at=user["created_at"])
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user: dict = Depends(require_auth)):
    return UserResponse(id=user["id"], email=user["email"], name=user["name"], created_at=user["created_at"])

# ==================== PRODUCTS ROUTES ====================

@api_router.get("/products")
async def get_products(
    category: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    metal: Optional[str] = None,
    color: Optional[str] = None,
    search: Optional[str] = None,
    sort: Optional[str] = "newest",
    limit: int = 50,
    skip: int = 0
):
    query = {}
    if category:
        query["category"] = category.lower()
    if min_price is not None:
        query["price"] = {"$gte": min_price}
    if max_price is not None:
        query["price"] = {**query.get("price", {}), "$lte": max_price}
    if metal:
        query["metal"] = metal.lower()
    if color:
        query["color"] = color.lower()
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    
    sort_field = {"newest": ("created_at", -1), "price_low": ("price", 1), "price_high": ("price", -1), "popular": ("reviews_count", -1)}
    sort_key, sort_dir = sort_field.get(sort, ("created_at", -1))
    
    products = await db.products.find(query, {"_id": 0}).sort(sort_key, sort_dir).skip(skip).limit(limit).to_list(limit)
    total = await db.products.count_documents(query)
    
    return {"products": products, "total": total, "skip": skip, "limit": limit}

@api_router.get("/products/featured")
async def get_featured_products():
    bestsellers = await db.products.find({"is_bestseller": True}, {"_id": 0}).limit(8).to_list(8)
    new_arrivals = await db.products.find({"is_new": True}, {"_id": 0}).limit(8).to_list(8)
    return {"bestsellers": bestsellers, "new_arrivals": new_arrivals}

@api_router.get("/products/{product_id}")
async def get_product(product_id: str):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Get related products
    related = await db.products.find(
        {"category": product["category"], "id": {"$ne": product_id}},
        {"_id": 0}
    ).limit(4).to_list(4)
    
    return {"product": product, "related": related}

@api_router.get("/categories")
async def get_categories():
    categories = [
        {"id": "rings", "name": "Rings", "image": "https://images.unsplash.com/photo-1724937798320-d0c4fac1787d?w=400"},
        {"id": "necklaces", "name": "Necklaces", "image": "https://images.pexels.com/photos/6502503/pexels-photo-6502503.jpeg?w=400"},
        {"id": "earrings", "name": "Earrings", "image": "https://images.unsplash.com/photo-1758995115555-766abbd9a491?w=400"},
        {"id": "bracelets", "name": "Bracelets", "image": "https://images.pexels.com/photos/4166450/pexels-photo-4166450.jpeg?w=400"},
        {"id": "bangles", "name": "Bangles", "image": "https://images.pexels.com/photos/4166450/pexels-photo-4166450.jpeg?w=400"},
        {"id": "anklets", "name": "Anklets", "image": "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=400"},
        {"id": "pendants", "name": "Pendants", "image": "https://images.pexels.com/photos/6502503/pexels-photo-6502503.jpeg?w=400"},
        {"id": "nose-pins", "name": "Nose Pins", "image": "https://images.unsplash.com/photo-1758995115555-766abbd9a491?w=400"}
    ]
    return {"categories": categories}

# ==================== CART ROUTES ====================

@api_router.get("/cart")
async def get_cart(user: dict = Depends(require_auth)):
    cart = await db.carts.find_one({"user_id": user["id"]}, {"_id": 0})
    if not cart:
        return {"items": [], "total": 0}
    
    items_with_products = []
    total = 0
    for item in cart.get("items", []):
        product = await db.products.find_one({"id": item["product_id"]}, {"_id": 0})
        if product:
            items_with_products.append({**item, "product": product})
            total += product["price"] * item["quantity"]
    
    return {"items": items_with_products, "total": round(total, 2)}

@api_router.post("/cart/add")
async def add_to_cart(item: CartItem, user: dict = Depends(require_auth)):
    product = await db.products.find_one({"id": item.product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    cart = await db.carts.find_one({"user_id": user["id"]})
    if not cart:
        await db.carts.insert_one({
            "user_id": user["id"],
            "items": [{"product_id": item.product_id, "quantity": item.quantity}]
        })
    else:
        existing_item = next((i for i in cart["items"] if i["product_id"] == item.product_id), None)
        if existing_item:
            await db.carts.update_one(
                {"user_id": user["id"], "items.product_id": item.product_id},
                {"$inc": {"items.$.quantity": item.quantity}}
            )
        else:
            await db.carts.update_one(
                {"user_id": user["id"]},
                {"$push": {"items": {"product_id": item.product_id, "quantity": item.quantity}}}
            )
    
    return {"message": "Added to cart"}

@api_router.put("/cart/update")
async def update_cart_item(item: CartItem, user: dict = Depends(require_auth)):
    if item.quantity <= 0:
        await db.carts.update_one(
            {"user_id": user["id"]},
            {"$pull": {"items": {"product_id": item.product_id}}}
        )
    else:
        await db.carts.update_one(
            {"user_id": user["id"], "items.product_id": item.product_id},
            {"$set": {"items.$.quantity": item.quantity}}
        )
    return {"message": "Cart updated"}

@api_router.delete("/cart/{product_id}")
async def remove_from_cart(product_id: str, user: dict = Depends(require_auth)):
    await db.carts.update_one(
        {"user_id": user["id"]},
        {"$pull": {"items": {"product_id": product_id}}}
    )
    return {"message": "Item removed from cart"}

@api_router.delete("/cart")
async def clear_cart(user: dict = Depends(require_auth)):
    await db.carts.delete_one({"user_id": user["id"]})
    return {"message": "Cart cleared"}

# ==================== WISHLIST ROUTES ====================

@api_router.get("/wishlist")
async def get_wishlist(user: dict = Depends(require_auth)):
    wishlist = await db.wishlists.find_one({"user_id": user["id"]}, {"_id": 0})
    if not wishlist:
        return {"items": []}
    
    items_with_products = []
    for product_id in wishlist.get("product_ids", []):
        product = await db.products.find_one({"id": product_id}, {"_id": 0})
        if product:
            items_with_products.append(product)
    
    return {"items": items_with_products}

@api_router.post("/wishlist/add")
async def add_to_wishlist(item: WishlistItem, user: dict = Depends(require_auth)):
    product = await db.products.find_one({"id": item.product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    await db.wishlists.update_one(
        {"user_id": user["id"]},
        {"$addToSet": {"product_ids": item.product_id}},
        upsert=True
    )
    return {"message": "Added to wishlist"}

@api_router.delete("/wishlist/{product_id}")
async def remove_from_wishlist(product_id: str, user: dict = Depends(require_auth)):
    await db.wishlists.update_one(
        {"user_id": user["id"]},
        {"$pull": {"product_ids": product_id}}
    )
    return {"message": "Removed from wishlist"}

@api_router.get("/wishlist/check/{product_id}")
async def check_wishlist(product_id: str, user: dict = Depends(get_current_user)):
    if not user:
        return {"in_wishlist": False}
    wishlist = await db.wishlists.find_one({"user_id": user["id"]}, {"_id": 0})
    in_wishlist = product_id in wishlist.get("product_ids", []) if wishlist else False
    return {"in_wishlist": in_wishlist}

# ==================== CHECKOUT/PAYMENT ROUTES ====================

@api_router.post("/checkout/create-session")
async def create_checkout_session(request: CheckoutRequest, http_request: Request, user: dict = Depends(require_auth)):
    from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest
    
    cart = await db.carts.find_one({"user_id": user["id"]}, {"_id": 0})
    if not cart or not cart.get("items"):
        raise HTTPException(status_code=400, detail="Cart is empty")
    
    total = 0.0
    for item in cart["items"]:
        product = await db.products.find_one({"id": item["product_id"]}, {"_id": 0})
        if product:
            total += product["price"] * item["quantity"]
    
    if total <= 0:
        raise HTTPException(status_code=400, detail="Invalid cart total")
    
    api_key = os.environ.get("STRIPE_API_KEY")
    host_url = str(http_request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    
    success_url = f"{request.origin_url}/checkout/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{request.origin_url}/cart"
    
    checkout_request = CheckoutSessionRequest(
        amount=round(total, 2),
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={"user_id": user["id"], "user_email": user["email"]}
    )
    
    session = await stripe_checkout.create_checkout_session(checkout_request)
    
    # Create payment transaction record
    transaction = {
        "id": str(uuid.uuid4()),
        "session_id": session.session_id,
        "user_id": user["id"],
        "user_email": user["email"],
        "amount": total,
        "currency": "usd",
        "payment_status": "pending",
        "status": "initiated",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.payment_transactions.insert_one(transaction)
    
    return {"url": session.url, "session_id": session.session_id}

@api_router.get("/checkout/status/{session_id}")
async def get_checkout_status(session_id: str, http_request: Request, user: dict = Depends(require_auth)):
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    
    api_key = os.environ.get("STRIPE_API_KEY")
    host_url = str(http_request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    status = await stripe_checkout.get_checkout_status(session_id)
    
    # Update transaction status
    transaction = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if transaction and transaction["payment_status"] != "paid" and status.payment_status == "paid":
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"payment_status": status.payment_status, "status": status.status}}
        )
        # Create order and clear cart
        cart = await db.carts.find_one({"user_id": user["id"]}, {"_id": 0})
        if cart:
            order = {
                "id": str(uuid.uuid4()),
                "user_id": user["id"],
                "items": cart["items"],
                "total": transaction["amount"],
                "payment_session_id": session_id,
                "status": "confirmed",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.orders.insert_one(order)
            await db.carts.delete_one({"user_id": user["id"]})
    
    return {
        "status": status.status,
        "payment_status": status.payment_status,
        "amount_total": status.amount_total,
        "currency": status.currency
    }

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    
    body = await request.body()
    signature = request.headers.get("Stripe-Signature")
    
    api_key = os.environ.get("STRIPE_API_KEY")
    host_url = str(request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    
    try:
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        if webhook_response.payment_status == "paid":
            await db.payment_transactions.update_one(
                {"session_id": webhook_response.session_id},
                {"$set": {"payment_status": "paid", "status": "complete"}}
            )
        
        return {"received": True}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"received": True}

# ==================== AI ROUTES ====================

@api_router.post("/ai/chat")
async def ai_chat(chat: ChatMessage, user: dict = Depends(get_current_user)):
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    session_id = chat.session_id or str(uuid.uuid4())
    
    # Get chat history for context
    history = await db.chat_history.find({"session_id": session_id}, {"_id": 0}).sort("timestamp", 1).to_list(20)
    
    # Get some products for context
    products = await db.products.find({}, {"_id": 0, "name": 1, "category": 1, "price": 1, "description": 1}).limit(20).to_list(20)
    products_context = json.dumps(products[:10]) if products else "[]"
    
    system_message = f"""You are NAOM Jewels' AI shopping assistant. You help customers find the perfect jewelry pieces.
    
Available product categories: Rings, Necklaces, Earrings, Bracelets, Bangles, Anklets, Pendants, Nose Pins
Metal types: Gold, Silver, Rose Gold, Platinum
    
Some of our products: {products_context}

Be helpful, friendly, and knowledgeable about jewelry. Suggest products based on customer preferences.
Keep responses concise and engaging. If asked about specific products, provide helpful recommendations."""
    
    llm_chat = LlmChat(
        api_key=api_key,
        session_id=session_id,
        system_message=system_message
    ).with_model("openai", "gpt-4o")
    
    # Build conversation context
    for msg in history[-10:]:
        if msg.get("role") == "user":
            await llm_chat.send_message(UserMessage(text=msg["content"]))
    
    user_message = UserMessage(text=chat.message)
    response = await llm_chat.send_message(user_message)
    
    # Save to chat history
    timestamp = datetime.now(timezone.utc).isoformat()
    await db.chat_history.insert_one({
        "session_id": session_id,
        "role": "user",
        "content": chat.message,
        "timestamp": timestamp,
        "user_id": user["id"] if user else None
    })
    await db.chat_history.insert_one({
        "session_id": session_id,
        "role": "assistant",
        "content": response,
        "timestamp": timestamp,
        "user_id": user["id"] if user else None
    })
    
    return {"response": response, "session_id": session_id}

@api_router.get("/ai/recommendations")
async def get_recommendations(user: dict = Depends(get_current_user)):
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    
    # Get user's purchase/wishlist history if authenticated
    user_context = ""
    if user:
        wishlist = await db.wishlists.find_one({"user_id": user["id"]}, {"_id": 0})
        if wishlist and wishlist.get("product_ids"):
            wishlist_products = await db.products.find(
                {"id": {"$in": wishlist["product_ids"][:5]}}, 
                {"_id": 0, "name": 1, "category": 1}
            ).to_list(5)
            user_context = f"User's wishlist includes: {json.dumps(wishlist_products)}"
    
    # Get random products to recommend from
    all_products = await db.products.find({}, {"_id": 0}).limit(30).to_list(30)
    
    if not all_products:
        return {"recommendations": [], "reason": "No products available"}
    
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    
    llm_chat = LlmChat(
        api_key=api_key,
        session_id=f"rec_{str(uuid.uuid4())}",
        system_message="You are a jewelry recommendation engine. Respond ONLY with a JSON array of product IDs."
    ).with_model("openai", "gpt-4o")
    
    products_json = json.dumps([{"id": p["id"], "name": p["name"], "category": p["category"], "price": p["price"]} for p in all_products])
    
    prompt = f"""Given these products: {products_json}
{user_context}
Select 4-6 diverse product IDs that would make good recommendations. Consider variety in category and price.
Respond ONLY with a JSON array of IDs, e.g.: ["id1", "id2", "id3"]"""
    
    try:
        response = await llm_chat.send_message(UserMessage(text=prompt))
        # Parse the response to get product IDs
        import re
        ids_match = re.search(r'\[.*?\]', response, re.DOTALL)
        if ids_match:
            recommended_ids = json.loads(ids_match.group())
            recommended = [p for p in all_products if p["id"] in recommended_ids]
            if recommended:
                return {"recommendations": recommended, "reason": "AI-powered recommendations"}
    except Exception as e:
        logger.error(f"AI recommendation error: {e}")
    
    # Fallback to random selection
    import random
    recommended = random.sample(all_products, min(6, len(all_products)))
    return {"recommendations": recommended, "reason": "Featured products"}

# ==================== ORDERS ROUTES ====================

@api_router.get("/orders")
async def get_orders(user: dict = Depends(require_auth)):
    orders = await db.orders.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    
    for order in orders:
        items_with_products = []
        for item in order.get("items", []):
            product = await db.products.find_one({"id": item["product_id"]}, {"_id": 0})
            if product:
                items_with_products.append({**item, "product": product})
        order["items"] = items_with_products
    
    return {"orders": orders}

# ==================== SEED DATA ====================

@api_router.post("/seed")
async def seed_data():
    """Seed the database with sample products"""
    existing = await db.products.count_documents({})
    if existing > 0:
        return {"message": f"Database already has {existing} products"}
    
    products = [
        # Rings
        {"id": str(uuid.uuid4()), "name": "Golden Star Constellation Ring", "description": "Elegant 18K gold plated ring with celestial star design. Perfect for everyday luxury.", "price": 89.99, "original_price": 129.99, "category": "rings", "images": ["https://images.unsplash.com/photo-1724937798320-d0c4fac1787d?w=600"], "metal": "gold", "color": "gold", "stock": 25, "rating": 4.8, "reviews_count": 156, "is_bestseller": True, "is_new": False, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "name": "Silver Zircon Eternity Band", "description": "Stunning 925 sterling silver band with brilliant zircon stones.", "price": 129.99, "original_price": 179.99, "category": "rings", "images": ["https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600"], "metal": "silver", "color": "silver", "stock": 18, "rating": 4.7, "reviews_count": 89, "is_bestseller": False, "is_new": True, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "name": "Rose Gold Infinity Love Ring", "description": "Beautiful rose gold plated infinity ring symbolizing eternal love.", "price": 79.99, "original_price": 99.99, "category": "rings", "images": ["https://images.unsplash.com/photo-1603561596112-0a132b757442?w=600"], "metal": "rose gold", "color": "rose gold", "stock": 30, "rating": 4.9, "reviews_count": 234, "is_bestseller": True, "is_new": False, "created_at": datetime.now(timezone.utc).isoformat()},
        
        # Necklaces
        {"id": str(uuid.uuid4()), "name": "Diamond Heart Pendant Necklace", "description": "Exquisite pendant necklace featuring a diamond-encrusted heart design on a delicate chain.", "price": 199.99, "original_price": 299.99, "category": "necklaces", "images": ["https://images.pexels.com/photos/6502503/pexels-photo-6502503.jpeg?w=600"], "metal": "gold", "color": "gold", "stock": 15, "rating": 4.9, "reviews_count": 312, "is_bestseller": True, "is_new": False, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "name": "Layered Pearl Station Necklace", "description": "Elegant layered necklace with freshwater pearls. Perfect for special occasions.", "price": 149.99, "original_price": 199.99, "category": "necklaces", "images": ["https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600"], "metal": "silver", "color": "white", "stock": 20, "rating": 4.6, "reviews_count": 78, "is_bestseller": False, "is_new": True, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "name": "Minimalist Bar Necklace", "description": "Sleek and modern bar pendant necklace. Subtle elegance for everyday wear.", "price": 59.99, "original_price": 79.99, "category": "necklaces", "images": ["https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=600"], "metal": "gold", "color": "gold", "stock": 35, "rating": 4.5, "reviews_count": 145, "is_bestseller": False, "is_new": False, "created_at": datetime.now(timezone.utc).isoformat()},
        
        # Earrings
        {"id": str(uuid.uuid4()), "name": "Crystal Drop Earrings", "description": "Stunning crystal drop earrings that catch the light beautifully.", "price": 69.99, "original_price": 99.99, "category": "earrings", "images": ["https://images.unsplash.com/photo-1758995115555-766abbd9a491?w=600"], "metal": "silver", "color": "silver", "stock": 40, "rating": 4.8, "reviews_count": 267, "is_bestseller": True, "is_new": False, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "name": "Golden Huggie Hoops", "description": "Classic huggie hoop earrings in polished gold. Versatile and chic.", "price": 49.99, "original_price": 69.99, "category": "earrings", "images": ["https://images.unsplash.com/photo-1630019852942-f89202989a59?w=600"], "metal": "gold", "color": "gold", "stock": 50, "rating": 4.7, "reviews_count": 189, "is_bestseller": False, "is_new": True, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "name": "Pearl Stud Earrings", "description": "Timeless freshwater pearl studs set in sterling silver.", "price": 39.99, "original_price": 59.99, "category": "earrings", "images": ["https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=600"], "metal": "silver", "color": "white", "stock": 60, "rating": 4.9, "reviews_count": 421, "is_bestseller": True, "is_new": False, "created_at": datetime.now(timezone.utc).isoformat()},
        
        # Bracelets
        {"id": str(uuid.uuid4()), "name": "Tennis Bracelet Classic", "description": "Elegant tennis bracelet with brilliant-cut stones. A timeless piece.", "price": 179.99, "original_price": 249.99, "category": "bracelets", "images": ["https://images.pexels.com/photos/4166450/pexels-photo-4166450.jpeg?w=600"], "metal": "silver", "color": "silver", "stock": 12, "rating": 4.9, "reviews_count": 198, "is_bestseller": True, "is_new": False, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "name": "Charm Link Bracelet", "description": "Playful charm bracelet with delicate gold links and removable charms.", "price": 89.99, "original_price": 119.99, "category": "bracelets", "images": ["https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=600"], "metal": "gold", "color": "gold", "stock": 25, "rating": 4.6, "reviews_count": 134, "is_bestseller": False, "is_new": True, "created_at": datetime.now(timezone.utc).isoformat()},
        
        # Bangles
        {"id": str(uuid.uuid4()), "name": "Crystal Bangle Set", "description": "Set of 3 stackable bangles with crystal accents.", "price": 119.99, "original_price": 159.99, "category": "bangles", "images": ["https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=600"], "metal": "gold", "color": "gold", "stock": 20, "rating": 4.7, "reviews_count": 156, "is_bestseller": False, "is_new": False, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "name": "Sleek Modern Bangle", "description": "Minimalist bangle with a sleek, modern design. Perfect for stacking.", "price": 59.99, "original_price": 79.99, "category": "bangles", "images": ["https://images.unsplash.com/photo-1535632787350-4e68ef0ac584?w=600"], "metal": "silver", "color": "silver", "stock": 35, "rating": 4.5, "reviews_count": 89, "is_bestseller": False, "is_new": True, "created_at": datetime.now(timezone.utc).isoformat()},
        
        # Anklets
        {"id": str(uuid.uuid4()), "name": "Dainty Chain Anklet", "description": "Delicate gold chain anklet with tiny heart charms.", "price": 34.99, "original_price": 49.99, "category": "anklets", "images": ["https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=600"], "metal": "gold", "color": "gold", "stock": 45, "rating": 4.6, "reviews_count": 178, "is_bestseller": True, "is_new": False, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "name": "Beaded Anklet Set", "description": "Set of 2 beaded anklets in complementary colors.", "price": 29.99, "original_price": 39.99, "category": "anklets", "images": ["https://images.unsplash.com/photo-1602173574767-37ac01994b2a?w=600"], "metal": "silver", "color": "multicolor", "stock": 50, "rating": 4.4, "reviews_count": 67, "is_bestseller": False, "is_new": True, "created_at": datetime.now(timezone.utc).isoformat()},
        
        # Pendants
        {"id": str(uuid.uuid4()), "name": "Birthstone Pendant", "description": "Personalized birthstone pendant in your choice of month. Makes a meaningful gift.", "price": 79.99, "original_price": 99.99, "category": "pendants", "images": ["https://images.unsplash.com/photo-1599643477877-530eb83abc8e?w=600"], "metal": "silver", "color": "multicolor", "stock": 30, "rating": 4.8, "reviews_count": 245, "is_bestseller": True, "is_new": False, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "name": "Initial Letter Pendant", "description": "Elegant initial pendant. A personal touch for everyday style.", "price": 49.99, "original_price": 69.99, "category": "pendants", "images": ["https://images.unsplash.com/photo-1611085583191-a3b181a88401?w=600"], "metal": "gold", "color": "gold", "stock": 40, "rating": 4.7, "reviews_count": 156, "is_bestseller": False, "is_new": False, "created_at": datetime.now(timezone.utc).isoformat()},
        
        # Nose Pins
        {"id": str(uuid.uuid4()), "name": "Diamond Nose Stud", "description": "Delicate diamond nose stud in 14K gold setting.", "price": 69.99, "original_price": 89.99, "category": "nose-pins", "images": ["https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=600"], "metal": "gold", "color": "gold", "stock": 25, "rating": 4.9, "reviews_count": 134, "is_bestseller": True, "is_new": False, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "name": "Tiny Flower Nose Ring", "description": "Adorable flower-shaped nose ring with crystal center.", "price": 29.99, "original_price": 39.99, "category": "nose-pins", "images": ["https://images.unsplash.com/photo-1602173574767-37ac01994b2a?w=600"], "metal": "silver", "color": "silver", "stock": 55, "rating": 4.6, "reviews_count": 89, "is_bestseller": False, "is_new": True, "created_at": datetime.now(timezone.utc).isoformat()},
    ]
    
    await db.products.insert_many(products)
    return {"message": f"Seeded {len(products)} products"}

# ==================== ROOT ====================

@api_router.get("/")
async def root():
    return {"message": "Welcome to NAOM Jewels API", "version": "1.0.0"}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
