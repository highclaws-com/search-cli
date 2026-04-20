#!/bin/bash
set -e

PORT=${1:-8000}
API_URL="http://127.0.0.1:${PORT}"
CLI="node src/search-cli.js --endpoint $API_URL"

echo "=========================================="
echo "1. Triggering Indexing"
echo "=========================================="
$CLI index
echo ""

echo "Waiting for indexing to complete..."
sleep 1
while true; do
    STATUS=$($CLI status | jq -r '.is_indexing')
    if [ "$STATUS" == "false" ] || [ "$STATUS" == "null" ]; then
        echo "Indexing completed or not running."
        break
    fi
    echo "Still indexing..."
    sleep 2
done

echo "=========================================="
echo "2. Search tests"
echo "=========================================="
set -x
$CLI keyword-search "doc1"
$CLI keyword-search "武汉大桥" # needs high recall
$CLI keyword-search "貓狗朋友" --snippet-length 800
$CLI vector-search "loyal" --limit 2
# with tags:
$CLI keyword-search --tags '[fts_chunk:2]' -- sadness
$CLI search --tags '[filename:shakespeare.txt]' -- boat
$CLI search --tags '[ext:.txt]' -- castle

# with mtime pre-filter
$CLI search "loyal" --mtime-gte $(date -d "2 days ago" +%s)
$CLI search "boat" --mtime-gte $(date -d "1 month ago" +%s) --mtime-lte $(date -d "yesterday" +%s)
set +x

echo "=========================================="
echo "3. Tags tests"
echo "=========================================="
set -x
$CLI tags lookup "/foo/doc1" "/foo/doc2"
$CLI tags update "/foo/doc1" "[todo]" "[unread]"
$CLI tags update "/foo/doc2" "[reference]"
$CLI tags lookup "/foo/doc1" "/foo/doc2"
set +x
