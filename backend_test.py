import requests
import sys
import json
import time
from datetime import datetime

class NAOMJewelsAPITester:
    def __init__(self, base_url="http://localhost:8000/api"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "name": name,
            "success": success,
            "details": details
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            details = f"Status: {response.status_code}"
            
            if not success:
                try:
                    error_data = response.json()
                    details += f", Response: {error_data}"
                except:
                    details += f", Response: {response.text[:200]}"
            
            self.log_test(name, success, details)
            
            if success:
                try:
                    return response.json()
                except:
                    return {}
            return {}

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return {}

    def test_seed_data(self):
        """Seed the database with test data"""
        print("\n🌱 Seeding database...")
        result = self.run_test("Seed Database", "POST", "seed", 200)
        return result

    def test_categories(self):
        """Test categories endpoint"""
        print("\n📂 Testing Categories...")
        result = self.run_test("Get Categories", "GET", "categories", 200)
        
        if result and 'categories' in result:
            categories = result['categories']
            expected_categories = ['rings', 'necklaces', 'earrings', 'bracelets', 'bangles', 'anklets', 'pendants', 'nose-pins']
            found_categories = [cat['id'] for cat in categories]
            
            all_found = all(cat in found_categories for cat in expected_categories)
            self.log_test("All Required Categories Present", all_found, 
                         f"Expected: {expected_categories}, Found: {found_categories}")
        
        return result

    def test_products(self):
        """Test products endpoints"""
        print("\n🛍️ Testing Products...")
        
        # Test get all products
        result = self.run_test("Get All Products", "GET", "products", 200)
        
        if result and 'products' in result:
            products = result['products']
            self.log_test("Products List Not Empty", len(products) > 0, f"Found {len(products)} products")
            
            if products:
                # Test product structure
                product = products[0]
                required_fields = ['id', 'name', 'price', 'category', 'images', 'metal']
                has_all_fields = all(field in product for field in required_fields)
                self.log_test("Product Has Required Fields", has_all_fields, 
                             f"Required: {required_fields}, Present: {list(product.keys())}")
                
                # Test get single product
                product_id = product['id']
                single_result = self.run_test("Get Single Product", "GET", f"products/{product_id}", 200)
                
                if single_result and 'product' in single_result:
                    self.log_test("Single Product Retrieved", True)
                
        # Test product filtering
        self.run_test("Filter Products by Category", "GET", "products?category=rings", 200)
        self.run_test("Filter Products by Metal", "GET", "products?metal=gold", 200)
        self.run_test("Search Products", "GET", "products?search=ring", 200)
        
        # Test featured products
        self.run_test("Get Featured Products", "GET", "products/featured", 200)
        
        return result

    def test_authentication(self):
        """Test authentication endpoints"""
        print("\n🔐 Testing Authentication...")
        
        # Generate unique test user
        timestamp = int(time.time())
        test_email = f"test{timestamp}@naomjewels.com"
        test_password = "TestPassword123!"
        test_name = f"Test User {timestamp}"
        
        # Test registration
        register_data = {
            "name": test_name,
            "email": test_email,
            "password": test_password
        }
        
        register_result = self.run_test("User Registration", "POST", "auth/register", 200, register_data)
        
        if register_result and 'access_token' in register_result:
            self.token = register_result['access_token']
            self.user_id = register_result['user']['id']
            self.log_test("Registration Token Received", True)
            
            # Test get current user
            self.run_test("Get Current User", "GET", "auth/me", 200)
            
            # Test login with same credentials
            login_data = {
                "email": test_email,
                "password": test_password
            }
            
            login_result = self.run_test("User Login", "POST", "auth/login", 200, login_data)
            
            if login_result and 'access_token' in login_result:
                self.token = login_result['access_token']  # Update token
                self.log_test("Login Token Received", True)
        
        # Test invalid login
        invalid_login = {
            "email": "invalid@test.com",
            "password": "wrongpassword"
        }
        self.run_test("Invalid Login Rejected", "POST", "auth/login", 401, invalid_login)
        
        return register_result

    def test_cart_functionality(self):
        """Test cart endpoints"""
        print("\n🛒 Testing Cart Functionality...")
        
        if not self.token:
            self.log_test("Cart Test Skipped", False, "No authentication token")
            return
        
        # Get products first
        products_result = self.run_test("Get Products for Cart Test", "GET", "products?limit=1", 200)
        
        if not products_result or not products_result.get('products'):
            self.log_test("Cart Test Skipped", False, "No products available")
            return
        
        product_id = products_result['products'][0]['id']
        
        # Test add to cart
        add_cart_data = {"product_id": product_id, "quantity": 2}
        self.run_test("Add to Cart", "POST", "cart/add", 200, add_cart_data)
        
        # Test get cart
        cart_result = self.run_test("Get Cart", "GET", "cart", 200)
        
        if cart_result and 'items' in cart_result:
            items = cart_result['items']
            self.log_test("Cart Has Items", len(items) > 0, f"Found {len(items)} items")
            
            if items:
                # Test update cart item
                update_data = {"product_id": product_id, "quantity": 1}
                self.run_test("Update Cart Item", "PUT", "cart/update", 200, update_data)
                
                # Test remove from cart
                self.run_test("Remove from Cart", "DELETE", f"cart/{product_id}", 200)
        
        # Test clear cart
        self.run_test("Clear Cart", "DELETE", "cart", 200)

    def test_wishlist_functionality(self):
        """Test wishlist endpoints"""
        print("\n❤️ Testing Wishlist Functionality...")
        
        if not self.token:
            self.log_test("Wishlist Test Skipped", False, "No authentication token")
            return
        
        # Get products first
        products_result = self.run_test("Get Products for Wishlist Test", "GET", "products?limit=1", 200)
        
        if not products_result or not products_result.get('products'):
            self.log_test("Wishlist Test Skipped", False, "No products available")
            return
        
        product_id = products_result['products'][0]['id']
        
        # Test add to wishlist
        add_wishlist_data = {"product_id": product_id}
        self.run_test("Add to Wishlist", "POST", "wishlist/add", 200, add_wishlist_data)
        
        # Test get wishlist
        wishlist_result = self.run_test("Get Wishlist", "GET", "wishlist", 200)
        
        if wishlist_result and 'items' in wishlist_result:
            items = wishlist_result['items']
            self.log_test("Wishlist Has Items", len(items) > 0, f"Found {len(items)} items")
        
        # Test check wishlist
        self.run_test("Check Wishlist Item", "GET", f"wishlist/check/{product_id}", 200)
        
        # Test remove from wishlist
        self.run_test("Remove from Wishlist", "DELETE", f"wishlist/{product_id}", 200)

    def test_ai_functionality(self):
        """Test AI endpoints"""
        print("\n🤖 Testing AI Functionality...")
        
        # Test AI chat (works without authentication)
        chat_data = {
            "message": "Hello, can you help me find a gold ring?",
            "session_id": None
        }
        
        chat_result = self.run_test("AI Chat", "POST", "ai/chat", 200, chat_data)
        
        if chat_result and 'response' in chat_result:
            self.log_test("AI Chat Response Received", True, f"Response length: {len(chat_result['response'])}")
            
            # Test follow-up message with session
            if 'session_id' in chat_result:
                followup_data = {
                    "message": "What about silver rings?",
                    "session_id": chat_result['session_id']
                }
                self.run_test("AI Chat Follow-up", "POST", "ai/chat", 200, followup_data)
        
        # Test AI recommendations
        self.run_test("AI Recommendations", "GET", "ai/recommendations", 200)

    def test_checkout_functionality(self):
        """Test checkout endpoints"""
        print("\n💳 Testing Checkout Functionality...")
        
        if not self.token:
            self.log_test("Checkout Test Skipped", False, "No authentication token")
            return
        
        # Add item to cart first
        products_result = self.run_test("Get Products for Checkout Test", "GET", "products?limit=1", 200)
        
        if not products_result or not products_result.get('products'):
            self.log_test("Checkout Test Skipped", False, "No products available")
            return
        
        product_id = products_result['products'][0]['id']
        add_cart_data = {"product_id": product_id, "quantity": 1}
        self.run_test("Add to Cart for Checkout", "POST", "cart/add", 200, add_cart_data)
        
        # Test create checkout session
        checkout_data = {"origin_url": "http://localhost:3000"}
        checkout_result = self.run_test("Create Checkout Session", "POST", "checkout/create-session", 200, checkout_data)
        
        if checkout_result and 'session_id' in checkout_result:
            session_id = checkout_result['session_id']
            self.log_test("Checkout Session Created", True, f"Session ID: {session_id[:8]}...")
            
            # Test get checkout status
            self.run_test("Get Checkout Status", "GET", f"checkout/status/{session_id}", 200)

    def test_orders_functionality(self):
        """Test orders endpoint"""
        print("\n📦 Testing Orders Functionality...")
        
        if not self.token:
            self.log_test("Orders Test Skipped", False, "No authentication token")
            return
        
        # Test get orders (should work even if empty)
        self.run_test("Get Orders", "GET", "orders", 200)

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting NAOM Jewels API Tests")
        print(f"Testing endpoint: {self.base_url}")
        print("=" * 60)
        
        # Test basic connectivity
        try:
            response = requests.get(f"{self.base_url}/", timeout=10)
            self.log_test("API Connectivity", response.status_code == 200, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("API Connectivity", False, f"Exception: {str(e)}")
            return
        
        # Seed data first
        self.test_seed_data()
        
        # Run all tests
        self.test_categories()
        self.test_products()
        self.test_authentication()
        self.test_cart_functionality()
        self.test_wishlist_functionality()
        self.test_ai_functionality()
        self.test_checkout_functionality()
        self.test_orders_functionality()
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.tests_passed < self.tests_run:
            print("\n❌ Failed Tests:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  - {result['name']}: {result['details']}")
        
        return self.tests_passed == self.tests_run

def main():
    tester = NAOMJewelsAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())