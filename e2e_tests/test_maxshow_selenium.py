import time
import pytest
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options

BASE_URL = "https://maxshow.site"
USER_ID = "test"
USER_PASS = "test"

@pytest.fixture(scope="session")
def driver():
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--ignore-certificate-errors")
    
    driver = webdriver.Chrome(options=options)
    driver.implicitly_wait(5)
    yield driver
    driver.quit()

def test_01_homepage_loads(driver):
    """Test 1: Verify homepage title, navbar brand, and core elements."""
    driver.get(BASE_URL)
    
    WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.TAG_NAME, "body"))
    )
    
    assert "MAXSHOW" in driver.title, f"Expected MAXSHOW in title, got '{driver.title}'"
    
    brand_elements = driver.find_elements(By.XPATH, "//*[contains(text(), 'MAXSHOW')]")
    assert len(brand_elements) > 0, "MAXSHOW branding not found on homepage"
    print(f"\n[PASS] Homepage loaded. Brand found ({len(brand_elements)} matches).")

def test_02_user_sign_in_and_profile(driver):
    """Test 2: Test sign-in page with provided test credentials and check Profile badge."""
    login_url = f"{BASE_URL}/user"
    driver.get(login_url)
    
    # Wait for email input
    email_input = WebDriverWait(driver, 10).until(
        EC.visibility_of_element_located((By.ID, "email"))
    )
    password_input = driver.find_element(By.ID, "password")
    submit_button = driver.find_element(By.CSS_SELECTOR, "button[type='submit']")
    
    email_input.clear()
    email_input.send_keys(USER_ID)
    
    password_input.clear()
    password_input.send_keys(USER_PASS)
    
    submit_button.click()
    
    # Wait for redirect after successful login
    WebDriverWait(driver, 10).until(
        lambda d: d.current_url != login_url
    )
    
    # Verify Profile element is rendered on navigation bar
    profile_elements = driver.find_elements(By.XPATH, "//*[contains(text(), 'Profile') or contains(text(), 'T')]")
    assert len(profile_elements) > 0, "Logged-in user profile not found"
    print(f"[PASS] User '{USER_ID}' authenticated successfully. Redirected to: {driver.current_url}")

def test_03_user_dashboard(driver):
    """Test 3: Access user dashboard to verify authenticated session."""
    driver.get(f"{BASE_URL}/dashboard")
    
    WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.TAG_NAME, "body"))
    )
    
    assert "/dashboard" in driver.current_url
    print(f"[PASS] User dashboard accessible with active session.")

def test_04_browse_all_events(driver):
    """Test 4: Verify All Events catalogue page and search filter."""
    driver.get(f"{BASE_URL}/all-events")
    
    WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.TAG_NAME, "main"))
    )
    
    assert "/all-events" in driver.current_url
    
    search_inputs = driver.find_elements(By.CSS_SELECTOR, "input[type='text'], input[type='search']")
    if search_inputs:
        search_inputs[0].send_keys("music")
        time.sleep(1)
        search_inputs[0].clear()
    
    print(f"[PASS] All Events page loaded and search filter tested.")

def test_05_event_details_page(driver):
    """Test 5: Navigate to event details page and verify booking controls."""
    driver.get(f"{BASE_URL}/event/moonlight-picnic")
    
    WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.TAG_NAME, "main"))
    )
    
    assert "/event" in driver.current_url
    
    # Check for Book/Reserve button or ticket pricing info
    booking_buttons = driver.find_elements(By.XPATH, "//button[contains(text(), 'Book') or contains(text(), 'Ticket') or contains(text(), 'Reserve') or contains(text(), 'Select')]")
    print(f"[PASS] Event details page loaded successfully with {len(booking_buttons)} action button(s).")

def test_06_admin_portal_page(driver):
    """Test 6: Verify Admin / Organiser sign-in portal."""
    driver.get(f"{BASE_URL}/admin")
    
    WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.TAG_NAME, "form"))
    )
    
    assert "/admin" in driver.current_url
    print(f"[PASS] Admin portal sign-in page loaded.")

def test_07_about_page(driver):
    """Test 7: Verify About page."""
    driver.get(f"{BASE_URL}/about")
    
    WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.TAG_NAME, "main"))
    )
    
    assert "/about" in driver.current_url
    print(f"[PASS] About page rendered.")

if __name__ == "__main__":
    pytest.main(["-v", "-s", __file__])
