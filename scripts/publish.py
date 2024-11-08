import os
import subprocess
import json
import argparse

def validate_package_json():
    """Validate package.json exists and has required fields"""
    if not os.path.exists('package.json'):
        raise Exception('package.json not found')
    
    with open('package.json') as f:
        package = json.load(f)
        
    required_fields = ['name', 'displayName', 'description', 'version', 'publisher']
    missing = [field for field in required_fields if field not in package]
    if missing:
        raise Exception(f'Missing required fields in package.json: {", ".join(missing)}')

def install_vsce():
    """Install vsce if not already installed"""
    try:
        subprocess.run(['vsce', '--version'], check=True, capture_output=True)
    except subprocess.CalledProcessError:
        print('Installing vsce...')
        subprocess.run(['npm', 'install', '-g', 'vsce'], check=True)

def package_extension():
    """Package the extension"""
    print('Packaging extension...')
    subprocess.run(['vsce', 'package'], check=True)

def publish_extension(token):
    """Publish the extension"""
    print('Publishing extension...')
    subprocess.run(['vsce', 'publish', '-p', token], check=True)

def main():
    parser = argparse.ArgumentParser(description='Publish VS Code extension')
    parser.add_argument('--token', required=True, help='Personal access token')
    args = parser.parse_args()

    try:
        # Validate package.json
        validate_package_json()
        
        # Install vsce if needed
        install_vsce()
        
        # Package extension
        package_extension()
        
        # Publish extension
        publish_extension(args.token)
        
        print('Extension published successfully!')
        
    except Exception as e:
        print(f'Error: {str(e)}')
        exit(1)

if __name__ == '__main__':
    main()
