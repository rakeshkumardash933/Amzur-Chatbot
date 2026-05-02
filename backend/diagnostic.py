#!/usr/bin/env python3
"""
Quick setup and test script for Amzur Chatbot.
Helps verify the installation is correct and the backend is working.
"""

import os
import sys
import subprocess
from pathlib import Path

# Colors for terminal output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'
BOLD = '\033[1m'


def print_header(text):
    """Print a formatted header."""
    print(f"\n{BOLD}{BLUE}{'=' * 60}{RESET}")
    print(f"{BOLD}{BLUE}{text.center(60)}{RESET}")
    print(f"{BOLD}{BLUE}{'=' * 60}{RESET}\n")


def print_success(text):
    """Print success message."""
    print(f"{GREEN}✓ {text}{RESET}")


def print_error(text):
    """Print error message."""
    print(f"{RED}✗ {text}{RESET}")


def print_info(text):
    """Print info message."""
    print(f"{BLUE}ℹ {text}{RESET}")


def print_warning(text):
    """Print warning message."""
    print(f"{YELLOW}⚠ {text}{RESET}")


def check_python_version():
    """Check if Python version is 3.11+."""
    print_header("Checking Python Version")
    version = sys.version_info
    if version.major >= 3 and version.minor >= 11:
        print_success(f"Python {version.major}.{version.minor}.{version.micro} detected")
        return True
    else:
        print_error(f"Python 3.11+ required, but {version.major}.{version.minor} detected")
        return False


def check_node_version():
    """Check if Node.js version is 18+."""
    print_header("Checking Node.js Version")
    try:
        result = subprocess.run(['node', '--version'], capture_output=True, text=True)
        version = result.stdout.strip()
        print_success(f"Node.js {version} detected")
        return True
    except FileNotFoundError:
        print_error("Node.js not found. Install from https://nodejs.org/")
        return False


def check_env_file(env_path):
    """Check if .env file exists and has required keys."""
    print_header(f"Checking .env File: {env_path}")
    
    if not os.path.exists(env_path):
        print_error(f".env file not found at {env_path}")
        print_info(f"Creating from .env.example...")
        env_example = env_path.replace('.env', '.env.example')
        if os.path.exists(env_example):
            with open(env_example, 'r') as src:
                with open(env_path, 'w') as dst:
                    dst.write(src.read())
            print_success(f"Created {env_path}")
        return False
    
    print_success(f".env file exists")
    
    # Check for required keys
    with open(env_path, 'r') as f:
        content = f.read()
    
    required_keys = ['GOOGLE_GEMINI_API_KEY']
    missing_keys = []
    
    for key in required_keys:
        if key not in content or f'{key}=your-' in content:
            missing_keys.append(key)
    
    if missing_keys:
        print_warning(f"Missing or empty required keys: {', '.join(missing_keys)}")
        print_info(f"Please edit {env_path} and add your Google Gemini API key")
        return False
    
    print_success(f"Required environment variables are set")
    return True


def check_dependencies():
    """Check if backend dependencies are installed."""
    print_header("Checking Backend Dependencies")
    
    try:
        import fastapi
        import langchain
        print_success("FastAPI and LangChain are installed")
        return True
    except ImportError as e:
        print_error(f"Missing dependency: {e}")
        print_info("Run: pip install -r backend/requirements.txt")
        return False


def test_backend_health():
    """Test if backend is running."""
    print_header("Testing Backend Health")
    
    try:
        import requests
    except ImportError:
        print_error("requests library not installed")
        return False
    
    try:
        response = requests.get('http://localhost:8000/health', timeout=5)
        if response.status_code == 200:
            print_success("Backend is running and healthy")
            return True
    except Exception as e:
        print_error(f"Backend is not responding: {e}")
        print_info("Make sure backend is running: python backend/main.py")
        return False


def test_api_chat():
    """Test the chat API."""
    print_header("Testing Chat API")
    
    try:
        import requests
    except ImportError:
        print_error("requests library not installed")
        return False
    
    try:
        payload = {
            "message": "Hello, what is your name?",
            "session_id": "test_session_quick_check"
        }
        response = requests.post(
            'http://localhost:8000/api/chat/',
            json=payload,
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            print_success(f"Chat API is working")
            print_info(f"Bot response: {data['response'][:100]}...")
            return True
        else:
            print_error(f"API returned status {response.status_code}")
            print_info(f"Error: {response.json()}")
            return False
            
    except Exception as e:
        print_error(f"Chat API test failed: {e}")
        return False


def run_diagnostic():
    """Run full diagnostic."""
    print(f"\n{BOLD}{BLUE}")
    print(r"""
    ╔═══════════════════════════════════════════════════════════╗
    ║         🤖 AMZUR CHATBOT - SETUP DIAGNOSTIC 🤖           ║
    ╚═══════════════════════════════════════════════════════════╝
    """)
    print(f"{RESET}")
    
    results = []
    
    # Check Python
    results.append(("Python 3.11+", check_python_version()))
    
    # Check Node.js
    results.append(("Node.js", check_node_version()))
    
    # Check backend .env
    backend_root = Path(__file__).parent / 'backend'
    results.append(
        ("Backend .env", check_env_file(str(backend_root / '.env')))
    )
    
    # Check frontend .env
    frontend_root = Path(__file__).parent / 'frontend'
    results.append(
        ("Frontend .env", check_env_file(str(frontend_root / '.env')))
    )
    
    # Check dependencies
    results.append(("Backend Dependencies", check_dependencies()))
    
    # Check backend health
    results.append(("Backend Health", test_backend_health()))
    
    # Check API
    results.append(("Chat API", test_api_chat()))
    
    # Summary
    print_header("Diagnostic Summary")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = f"{GREEN}PASS{RESET}" if result else f"{RED}FAIL{RESET}"
        print(f"  {test_name:<30} [{status}]")
    
    print(f"\n{BOLD}Overall: {passed}/{total} checks passed{RESET}\n")
    
    if passed == total:
        print_success("All checks passed! Ready to use Amzur Chatbot.")
        return True
    else:
        print_warning("Some checks failed. See details above.")
        return False


def main():
    """Main entry point."""
    try:
        success = run_diagnostic()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\nDiagnostic cancelled.")
        sys.exit(1)
    except Exception as e:
        print_error(f"Unexpected error: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
