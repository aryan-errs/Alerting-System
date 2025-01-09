#!/bin/bash

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

API_URL="http://localhost:3000"
AUTH_TOKEN="test-token-123"
INVALID_TOKEN="wrong-token"

echo -e "${GREEN}Starting Alert System Test...${NC}"

# 1. Clear Redis cache
echo -e "\n${GREEN}Clearing Redis cache:${NC}"
redis-cli FLUSHALL

# 2. Test with invalid token multiple times to trigger alert
echo -e "\n${GREEN}Sending multiple failed requests to trigger alert...${NC}"
# keeping the requests to 5 so that the alert is triggered.
for i in {1..5}; do
  echo -e "\n${GREEN}Request $i:${NC}"
  curl -X POST "$API_URL/api/submit" \
    -H "Authorization: Bearer $INVALID_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"metric": "test_metric", "value": 200}' \
    -w "\nStatus Code: %{http_code}\n"

  sleep 1
done

# 3. Check metrics to verify failed attempts were logged
echo -e "\n${GREEN}Checking metrics for failed attempts:${NC}"
curl "$API_URL/api/metrics" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -w "\nStatus Code: %{http_code}\n"

# 4. Check Redis keys
echo -e "\n${GREEN}Checking Redis keys:${NC}"
redis-cli KEYS "*"

# 5. Monitor Redis in real-time (optional)
echo -e "\n${GREEN}To monitor Redis in real-time, open a new terminal and run:${NC}"
echo "redis-cli monitor"

# Display email configuration check
echo -e "\n${GREEN}If alerts are configured correctly, you should receive an email after exceeding the failed attempt threshold.${NC}"
echo -e "Check your email configuration in .env:"
echo "SMTP_HOST"
echo "SMTP_PORT"
echo "SMTP_USER"
echo "SMTP_PASS"
echo "ALERT_RECIPIENTS"
