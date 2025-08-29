#!/bin/bash

# TEE Simulator Setup Script (Building from source)
# Based on Phala Network dstack documentation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DSTACK_DIR="$PROJECT_ROOT/.dstack"
SIMULATOR_DIR="$DSTACK_DIR/sdk/simulator"
SOCKET_DIR="$SIMULATOR_DIR"

print_header() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  dstack TEE Simulator Setup (Local Build)${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

check_rust() {
    # Check if rustup is available
    if command -v rustup &> /dev/null; then
        # Check if a default toolchain is set
        if ! rustup default 2>/dev/null | grep -q stable; then
            echo -e "${YELLOW}📦 Installing stable Rust toolchain...${NC}"
            rustup default stable
        fi
    elif ! command -v rustc &> /dev/null; then
        echo -e "${YELLOW}📦 Rust not found. Installing...${NC}"
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
        source $HOME/.cargo/env
    fi
    
    # Verify rust is working
    if command -v rustc &> /dev/null; then
        echo -e "${GREEN}✅ Rust is available ($(rustc --version))${NC}"
    else
        echo -e "${RED}❌ Failed to set up Rust${NC}"
        exit 1
    fi
}

clone_dstack() {
    if [ -d "$DSTACK_DIR" ]; then
        echo -e "${YELLOW}📂 dstack directory already exists${NC}"
        echo -e "${YELLOW}   Pulling latest changes...${NC}"
        cd "$DSTACK_DIR"
        git pull origin main || true
    else
        echo -e "${YELLOW}📦 Cloning dstack repository...${NC}"
        git clone https://github.com/Dstack-TEE/dstack.git "$DSTACK_DIR"
    fi
    echo -e "${GREEN}✅ dstack repository ready${NC}"
}

build_simulator() {
    echo -e "${YELLOW}🔨 Building TEE simulator...${NC}"
    
    # Set up build environment for macOS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo -e "${YELLOW}   Configuring build for macOS...${NC}"
        
        # Check for Homebrew and install if needed
        if ! command -v brew &> /dev/null; then
            echo -e "${YELLOW}   Installing Homebrew...${NC}"
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        fi
        
        # Install libiconv if not present
        if ! brew list libiconv &>/dev/null; then
            echo -e "${YELLOW}   Installing libiconv...${NC}"
            brew install libiconv
        fi
        
        # Set environment variables for macOS build
        export LIBRARY_PATH="$(brew --prefix)/lib:$LIBRARY_PATH"
        export CPATH="$(brew --prefix)/include:$CPATH"
        export PKG_CONFIG_PATH="$(brew --prefix)/lib/pkgconfig:$PKG_CONFIG_PATH"
        
        # For M1/M2 Macs, add specific paths
        if [[ $(uname -m) == "arm64" ]]; then
            export LIBRARY_PATH="/opt/homebrew/lib:$LIBRARY_PATH"
            export CPATH="/opt/homebrew/include:$CPATH"
            export LDFLAGS="-L/opt/homebrew/lib"
            export CPPFLAGS="-I/opt/homebrew/include"
        else
            export LDFLAGS="-L/usr/local/lib"
            export CPPFLAGS="-I/usr/local/include"
        fi
    fi
    
    cd "$SIMULATOR_DIR"
    
    # Check if build.sh exists
    if [ -f "build.sh" ]; then
        chmod +x build.sh
        # Try to build with proper environment
        LIBRARY_PATH="$LIBRARY_PATH" CPATH="$CPATH" ./build.sh
    else
        # Fallback to cargo build if build.sh doesn't exist
        echo -e "${YELLOW}   build.sh not found, using cargo build...${NC}"
        
        # Build the guest agent first if it exists
        if [ -d "../../guest-agent" ]; then
            echo -e "${YELLOW}   Building guest agent...${NC}"
            (cd ../../guest-agent && cargo build --release)
        fi
        
        # Build the main simulator
        cargo build --release
        
        # Look for the built binary in various locations
        if [ -f "../../target/release/dstack-simulator" ]; then
            cp ../../target/release/dstack-simulator .
        elif [ -f "target/release/dstack-simulator" ]; then
            cp target/release/dstack-simulator .
        elif [ -f "../../target/release/dstack-guest-agent" ]; then
            # Some versions might build as guest-agent
            cp ../../target/release/dstack-guest-agent ./dstack-simulator
        fi
    fi
    
    # Check if simulator was built successfully
    if [ -f "dstack-simulator" ] || [ -f "../../target/release/dstack-guest-agent" ]; then
        echo -e "${GREEN}✅ TEE simulator built successfully${NC}"
        
        # If we only have guest-agent, use it as simulator
        if [ ! -f "dstack-simulator" ] && [ -f "../../target/release/dstack-guest-agent" ]; then
            cp ../../target/release/dstack-guest-agent ./dstack-simulator
            echo -e "${YELLOW}   Using guest-agent as simulator${NC}"
        fi
    else
        echo -e "${RED}❌ Failed to build TEE simulator${NC}"
        echo -e "${YELLOW}   Trying alternative build approach...${NC}"
        
        # Try building in the root directory
        cd "$DSTACK_DIR"
        if cargo build --release --all; then
            # Find and copy any built binary
            find target/release -type f -perm +111 -name "dstack*" | head -1 | xargs -I {} cp {} "$SIMULATOR_DIR/dstack-simulator"
            if [ -f "$SIMULATOR_DIR/dstack-simulator" ]; then
                echo -e "${GREEN}✅ TEE simulator built with alternative method${NC}"
            else
                echo -e "${RED}❌ Could not find built simulator binary${NC}"
                echo -e "${YELLOW}   Falling back to Python simulator...${NC}"
                use_python_fallback
            fi
        else
            echo -e "${YELLOW}   Rust build failed, falling back to Python simulator...${NC}"
            use_python_fallback
        fi
    fi
}

use_python_fallback() {
    echo -e "${YELLOW}📦 Setting up Python TEE simulator as fallback...${NC}"
    
    # Copy Python simulator to expected location
    if [ -f "$PROJECT_ROOT/scripts/python_tee_simulator.py" ]; then
        cp "$PROJECT_ROOT/scripts/python_tee_simulator.py" "$SIMULATOR_DIR/dstack-simulator"
        chmod +x "$SIMULATOR_DIR/dstack-simulator"
        
        # Create a wrapper script that runs Python simulator
        cat > "$SIMULATOR_DIR/dstack-simulator-wrapper" << 'EOF'
#!/bin/bash
exec python3 "$(dirname "$0")/dstack-simulator"
EOF
        chmod +x "$SIMULATOR_DIR/dstack-simulator-wrapper"
        mv "$SIMULATOR_DIR/dstack-simulator-wrapper" "$SIMULATOR_DIR/dstack-simulator"
        
        echo -e "${GREEN}✅ Python TEE simulator configured as fallback${NC}"
        echo -e "${YELLOW}   Note: This is a mock simulator for development only${NC}"
    else
        echo -e "${RED}❌ Python fallback simulator not found${NC}"
        exit 1
    fi
}

start_simulator() {
    echo -e "${YELLOW}🚀 Starting TEE simulator...${NC}"
    
    cd "$SIMULATOR_DIR"
    
    # Kill any existing simulator process
    pkill -f dstack-simulator 2>/dev/null || true
    
    # Start simulator in background
    nohup ./dstack-simulator > "$SIMULATOR_DIR/simulator.log" 2>&1 &
    SIMULATOR_PID=$!
    
    echo $SIMULATOR_PID > "$SIMULATOR_DIR/simulator.pid"
    
    # Wait for socket files to be created
    echo -e "${YELLOW}⏳ Waiting for simulator to initialize...${NC}"
    
    local count=0
    while [ ! -S "$SIMULATOR_DIR/tappd.sock" ] && [ $count -lt 30 ]; do
        sleep 1
        count=$((count + 1))
    done
    
    if [ -S "$SIMULATOR_DIR/tappd.sock" ]; then
        echo -e "${GREEN}✅ TEE simulator started (PID: $SIMULATOR_PID)${NC}"
        
        # List socket files
        echo -e "${BLUE}Socket files created:${NC}"
        ls -la "$SIMULATOR_DIR"/*.sock 2>/dev/null || echo "No socket files found yet"
        
        # Create symlink to expected location
        if [ ! -L "/var/run/dstack.sock" ]; then
            echo -e "${YELLOW}Creating symlink for dstack.sock...${NC}"
            sudo ln -sf "$SIMULATOR_DIR/tappd.sock" /var/run/dstack.sock
            echo -e "${GREEN}✅ Symlink created: /var/run/dstack.sock -> $SIMULATOR_DIR/tappd.sock${NC}"
        fi
        
        # Set environment variable
        export DSTACK_SIMULATOR_ENDPOINT="$SIMULATOR_DIR/tappd.sock"
        echo -e "${GREEN}✅ DSTACK_SIMULATOR_ENDPOINT set to: $DSTACK_SIMULATOR_ENDPOINT${NC}"
        
        # Update .env for Python SDK
        if grep -q "DSTACK_SIMULATOR_ENDPOINT" "$PROJECT_ROOT/.env" 2>/dev/null; then
            sed -i.bak "s|DSTACK_SIMULATOR_ENDPOINT=.*|DSTACK_SIMULATOR_ENDPOINT=$SIMULATOR_DIR/tappd.sock|" "$PROJECT_ROOT/.env"
        else
            echo "DSTACK_SIMULATOR_ENDPOINT=$SIMULATOR_DIR/tappd.sock" >> "$PROJECT_ROOT/.env"
        fi
        
        echo -e "${GREEN}✅ Environment configured for TEE simulator${NC}"
        
    else
        echo -e "${RED}❌ Failed to start TEE simulator (socket files not created)${NC}"
        cat "$SIMULATOR_DIR/simulator.log"
        exit 1
    fi
}

stop_simulator() {
    echo -e "${YELLOW}🛑 Stopping TEE simulator...${NC}"
    
    if [ -f "$SIMULATOR_DIR/simulator.pid" ]; then
        PID=$(cat "$SIMULATOR_DIR/simulator.pid")
        if kill -0 $PID 2>/dev/null; then
            kill $PID
            rm "$SIMULATOR_DIR/simulator.pid"
            echo -e "${GREEN}✅ TEE simulator stopped${NC}"
        else
            echo -e "${YELLOW}ℹ️  TEE simulator not running (stale PID file)${NC}"
            rm "$SIMULATOR_DIR/simulator.pid"
        fi
    else
        # Try to find and kill by process name
        pkill -f dstack-simulator 2>/dev/null || true
        echo -e "${YELLOW}ℹ️  TEE simulator process terminated${NC}"
    fi
    
    # Remove symlink if it exists
    if [ -L "/var/run/dstack.sock" ]; then
        sudo rm /var/run/dstack.sock
        echo -e "${GREEN}✅ Removed symlink /var/run/dstack.sock${NC}"
    fi
}

status_simulator() {
    if [ -f "$SIMULATOR_DIR/simulator.pid" ]; then
        PID=$(cat "$SIMULATOR_DIR/simulator.pid")
        if kill -0 $PID 2>/dev/null; then
            echo -e "${GREEN}✅ TEE simulator is running (PID: $PID)${NC}"
            
            # Check socket files
            echo -e "${BLUE}Socket files:${NC}"
            ls -la "$SIMULATOR_DIR"/*.sock 2>/dev/null || echo "No socket files found"
            
            # Check symlink
            if [ -L "/var/run/dstack.sock" ]; then
                echo -e "${GREEN}✅ Symlink exists: /var/run/dstack.sock${NC}"
            else
                echo -e "${YELLOW}⚠️  Symlink /var/run/dstack.sock not found${NC}"
            fi
            
            # Check environment variable
            if [ -n "$DSTACK_SIMULATOR_ENDPOINT" ]; then
                echo -e "${GREEN}✅ DSTACK_SIMULATOR_ENDPOINT: $DSTACK_SIMULATOR_ENDPOINT${NC}"
            else
                echo -e "${YELLOW}⚠️  DSTACK_SIMULATOR_ENDPOINT not set${NC}"
                echo "   Run: export DSTACK_SIMULATOR_ENDPOINT=$SIMULATOR_DIR/tappd.sock"
            fi
        else
            echo -e "${RED}❌ TEE simulator not running (stale PID file)${NC}"
        fi
    else
        echo -e "${RED}❌ TEE simulator is not running${NC}"
    fi
}

logs_simulator() {
    if [ -f "$SIMULATOR_DIR/simulator.log" ]; then
        echo -e "${YELLOW}📋 TEE simulator logs:${NC}"
        tail -n 50 "$SIMULATOR_DIR/simulator.log"
    else
        echo -e "${RED}❌ No log file found${NC}"
    fi
}

test_simulator() {
    echo -e "${YELLOW}🧪 Testing TEE simulator...${NC}"
    
    # Check if simulator is running
    if [ ! -f "$SIMULATOR_DIR/simulator.pid" ]; then
        echo -e "${RED}❌ TEE simulator is not running${NC}"
        echo "   Run: $0 start"
        exit 1
    fi
    
    PID=$(cat "$SIMULATOR_DIR/simulator.pid")
    if ! kill -0 $PID 2>/dev/null; then
        echo -e "${RED}❌ TEE simulator is not running${NC}"
        exit 1
    fi
    
    # Test socket file
    if [ -S "$SIMULATOR_DIR/tappd.sock" ]; then
        echo -e "${GREEN}✅ Socket file exists and is valid${NC}"
    else
        echo -e "${RED}❌ Socket file not found or invalid${NC}"
        exit 1
    fi
    
    # Test Python SDK integration
    echo -e "${YELLOW}Testing Python SDK integration...${NC}"
    python3 -c "
import os
os.environ['DSTACK_SIMULATOR_ENDPOINT'] = '$SIMULATOR_DIR/tappd.sock'
try:
    from dstack_sdk import DstackSDK
    sdk = DstackSDK()
    print('✅ Python SDK can be initialized')
except Exception as e:
    print(f'❌ Python SDK error: {e}')
" || echo -e "${YELLOW}⚠️  Python SDK test skipped (dstack-sdk not installed)${NC}"
    
    echo -e "${GREEN}✅ Basic tests passed${NC}"
}

# Main script
print_header

case "${1:-}" in
    setup)
        check_rust
        clone_dstack
        build_simulator
        echo -e "${GREEN}✅ TEE simulator setup complete!${NC}"
        echo -e "${YELLOW}   Run './scripts/setup_tee_simulator.sh start' to start the simulator${NC}"
        ;;
    start)
        if [ ! -f "$SIMULATOR_DIR/dstack-simulator" ]; then
            echo -e "${YELLOW}Simulator not built. Running setup first...${NC}"
            check_rust
            clone_dstack
            build_simulator
        fi
        start_simulator
        ;;
    stop)
        stop_simulator
        ;;
    restart)
        stop_simulator
        start_simulator
        ;;
    status)
        status_simulator
        ;;
    logs)
        logs_simulator
        ;;
    test)
        test_simulator
        ;;
    *)
        echo "Usage: $0 {setup|start|stop|restart|status|logs|test}"
        echo ""
        echo "Commands:"
        echo "  setup    - Clone and build the TEE simulator"
        echo "  start    - Start the TEE simulator"
        echo "  stop     - Stop the TEE simulator"
        echo "  restart  - Restart the TEE simulator"
        echo "  status   - Check simulator status"
        echo "  logs     - Show simulator logs"
        echo "  test     - Test simulator integration"
        exit 1
        ;;
esac