#!/bin/bash
#
# Agento Health Check Script
# ==========================
#
# Usage:
#   ./scripts/health-check.sh [OPTIONS]
#
# Options:
#   --host HOST       Gateway host (default: localhost)
#   --port PORT       Gateway port (default: 18789)
#   --token TOKEN     Authentication token
#   --json            Output in JSON format
#   --verbose         Verbose output
#   --help            Show this help
#
# Exit codes:
#   0 - All checks passed
#   1 - Some checks failed
#   2 - Gateway not reachable

set -e

# Default values
HOST="localhost"
PORT="18789"
TOKEN=""
JSON_OUTPUT=false
VERBOSE=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --host)
            HOST="$2"
            shift 2
            ;;
        --port)
            PORT="$2"
            shift 2
            ;;
        --token)
            TOKEN="$2"
            shift 2
            ;;
        --json)
            JSON_OUTPUT=true
            shift
            ;;
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        --help|-h)
            echo "Agento Health Check Script"
            echo ""
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --host HOST       Gateway host (default: localhost)"
            echo "  --port PORT       Gateway port (default: 18789)"
            echo "  --token TOKEN     Authentication token"
            echo "  --json            Output in JSON format"
            echo "  --verbose         Verbose output"
            echo "  --help            Show this help"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

BASE_URL="http://${HOST}:${PORT}"
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_TOTAL=0

# Array to store results (for JSON output)
declare -a RESULTS

# Helper function to make authenticated requests
curl_auth() {
    local url="$1"
    shift
    if [ -n "$TOKEN" ]; then
        curl -s -H "Authorization: Bearer $TOKEN" "$@" "$url"
    else
        curl -s "$@" "$url"
    fi
}

# Check if gateway is reachable
check_gateway_reachable() {
    local name="gateway_reachable"
    local description="Gateway is reachable"
    CHECKS_TOTAL=$((CHECKS_TOTAL + 1))

    if curl -s --connect-timeout 5 "${BASE_URL}/api/health" > /dev/null 2>&1; then
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
        RESULTS+=("{\"name\":\"$name\",\"status\":\"pass\",\"description\":\"$description\"}")
        [ "$VERBOSE" = true ] && echo -e "${GREEN}✓${NC} $description"
        return 0
    else
        CHECKS_FAILED=$((CHECKS_FAILED + 1))
        RESULTS+=("{\"name\":\"$name\",\"status\":\"fail\",\"description\":\"$description\",\"message\":\"Cannot connect to ${BASE_URL}\"}")
        [ "$VERBOSE" = true ] && echo -e "${RED}✗${NC} $description - Cannot connect to ${BASE_URL}"
        return 1
    fi
}

# Check gateway health endpoint
check_health_endpoint() {
    local name="health_endpoint"
    local description="Health endpoint responds"
    CHECKS_TOTAL=$((CHECKS_TOTAL + 1))

    local response
    response=$(curl -s --connect-timeout 5 "${BASE_URL}/api/health" 2>/dev/null)

    if [ $? -eq 0 ] && [ -n "$response" ]; then
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
        RESULTS+=("{\"name\":\"$name\",\"status\":\"pass\",\"description\":\"$description\"}")
        [ "$VERBOSE" = true ] && echo -e "${GREEN}✓${NC} $description"
        return 0
    else
        CHECKS_FAILED=$((CHECKS_FAILED + 1))
        RESULTS+=("{\"name\":\"$name\",\"status\":\"fail\",\"description\":\"$description\"}")
        [ "$VERBOSE" = true ] && echo -e "${RED}✗${NC} $description"
        return 1
    fi
}

# Check if authentication is required
check_auth_required() {
    local name="auth_required"
    local description="Authentication is properly configured"
    CHECKS_TOTAL=$((CHECKS_TOTAL + 1))

    # Try to access protected endpoint without auth
    local status
    status=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/status" 2>/dev/null)

    # If we get 401, auth is working (or requireLocalAuth is true)
    # If we get 200 without token, localhost bypass is enabled (development mode)
    if [ "$status" = "401" ]; then
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
        RESULTS+=("{\"name\":\"$name\",\"status\":\"pass\",\"description\":\"$description\",\"message\":\"Authentication required\"}")
        [ "$VERBOSE" = true ] && echo -e "${GREEN}✓${NC} $description (authentication required)"
        return 0
    elif [ "$status" = "200" ]; then
        # This could be OK for development (localhost bypass)
        RESULTS+=("{\"name\":\"$name\",\"status\":\"warn\",\"description\":\"$description\",\"message\":\"Localhost bypass enabled (OK for development)\"}")
        [ "$VERBOSE" = true ] && echo -e "${YELLOW}!${NC} $description - Localhost bypass enabled (OK for development)"
        # Don't count as failure
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
        return 0
    else
        CHECKS_FAILED=$((CHECKS_FAILED + 1))
        RESULTS+=("{\"name\":\"$name\",\"status\":\"fail\",\"description\":\"$description\",\"message\":\"Unexpected status: $status\"}")
        [ "$VERBOSE" = true ] && echo -e "${RED}✗${NC} $description - Unexpected status: $status"
        return 1
    fi
}

# Check channels status
check_channels() {
    local name="channels_status"
    local description="Channels are configured"
    CHECKS_TOTAL=$((CHECKS_TOTAL + 1))

    local response
    response=$(curl_auth "${BASE_URL}/api/channels/status" 2>/dev/null)

    if [ $? -eq 0 ] && echo "$response" | grep -q '"enabled"\|"connected"\|"telegram"\|"whatsapp"'; then
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
        RESULTS+=("{\"name\":\"$name\",\"status\":\"pass\",\"description\":\"$description\"}")
        [ "$VERBOSE" = true ] && echo -e "${GREEN}✓${NC} $description"
        return 0
    else
        CHECKS_FAILED=$((CHECKS_FAILED + 1))
        RESULTS+=("{\"name\":\"$name\",\"status\":\"fail\",\"description\":\"$description\",\"message\":\"No channels configured or accessible\"}")
        [ "$VERBOSE" = true ] && echo -e "${RED}✗${NC} $description - No channels configured"
        return 1
    fi
}

# Check model configuration
check_model() {
    local name="model_config"
    local description="Model is configured"
    CHECKS_TOTAL=$((CHECKS_TOTAL + 1))

    local response
    response=$(curl_auth "${BASE_URL}/api/config" 2>/dev/null)

    if [ $? -eq 0 ] && echo "$response" | grep -q '"model"\|"primary"'; then
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
        RESULTS+=("{\"name\":\"$name\",\"status\":\"pass\",\"description\":\"$description\"}")
        [ "$VERBOSE" = true ] && echo -e "${GREEN}✓${NC} $description"
        return 0
    else
        CHECKS_FAILED=$((CHECKS_FAILED + 1))
        RESULTS+=("{\"name\":\"$name\",\"status\":\"fail\",\"description\":\"$description\"}")
        [ "$VERBOSE" = true ] && echo -e "${RED}✗${NC} $description"
        return 1
    fi
}

# Main execution
main() {
    if [ "$JSON_OUTPUT" = false ]; then
        echo -e "${BLUE}Agento Health Check${NC}"
        echo "====================="
        echo "Target: ${BASE_URL}"
        echo ""
    fi

    # Run checks
    check_gateway_reachable
    if [ $? -ne 0 ]; then
        # Gateway not reachable, skip other checks
        if [ "$JSON_OUTPUT" = true ]; then
            echo "{\"status\":\"error\",\"message\":\"Gateway not reachable\",\"checks\":[$(IFS=,; echo "${RESULTS[*]}")]}"
        else
            echo ""
            echo -e "${RED}Gateway is not reachable. Cannot perform further checks.${NC}"
        fi
        exit 2
    fi

    check_health_endpoint
    check_auth_required
    check_channels
    check_model

    # Output results
    if [ "$JSON_OUTPUT" = true ]; then
        local status="pass"
        if [ $CHECKS_FAILED -gt 0 ]; then
            status="fail"
        fi
        echo "{\"status\":\"$status\",\"passed\":$CHECKS_PASSED,\"failed\":$CHECKS_FAILED,\"total\":$CHECKS_TOTAL,\"checks\":[$(IFS=,; echo "${RESULTS[*]}")]}"
    else
        echo ""
        echo "====================="
        echo -e "Results: ${GREEN}$CHECKS_PASSED passed${NC}, ${RED}$CHECKS_FAILED failed${NC} out of $CHECKS_TOTAL checks"

        if [ $CHECKS_FAILED -eq 0 ]; then
            echo -e "${GREEN}All checks passed!${NC}"
            exit 0
        else
            echo -e "${RED}Some checks failed.${NC}"
            exit 1
        fi
    fi
}

main
