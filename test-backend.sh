#!/bin/bash
# EnvInsight AI Pro - Backend API Test Script

BASE="http://localhost:3000"
PASS=0
FAIL=0

assert_status() {
  local name=$1 expected=$2 actual=$3
  if [ "$actual" -eq "$expected" ]; then
    echo "  PASS: $name (HTTP $actual)"
    ((PASS++))
  else
    echo "  FAIL: $name (expected $expected, got $actual)"
    ((FAIL++))
  fi
}

echo "========================================"
echo " EnvInsight AI Pro - Backend API Tests"
echo "========================================"
echo ""

# 1. GET /api/news - fetch all news
echo "[1] GET /api/news"
STATUS=$(curl -s -o /tmp/test_news.json -w "%{http_code}" "$BASE/api/news")
assert_status "返回所有新闻" 200 "$STATUS"
COUNT=$(python3 -c "import json; print(len(json.load(open('/tmp/test_news.json'))))")
echo "  → 返回 $COUNT 条新闻"
echo ""

# 2. GET /api/news?q= - search
echo "[2] GET /api/news?q=塑料 (URL encoded)"
STATUS=$(curl -s -o /tmp/test_search.json -w "%{http_code}" "$BASE/api/news?q=%E5%A1%91%E6%96%99")
assert_status "关键词搜索" 200 "$STATUS"
COUNT=$(python3 -c "import json; print(len(json.load(open('/tmp/test_search.json'))))")
echo "  → 搜索到 $COUNT 条结果"
echo ""

# 3. GET /api/news?category= - filter by category
echo "[3] GET /api/news?category=空气质量 (URL encoded)"
STATUS=$(curl -s -o /tmp/test_cat.json -w "%{http_code}" "$BASE/api/news?category=%E7%A9%BA%E6%B0%94%E8%B4%A8%E9%87%8F")
assert_status "分类筛选" 200 "$STATUS"
COUNT=$(python3 -c "import json; data=json.load(open('/tmp/test_cat.json')); print(len(data)); [print(f'  → {d[\"title\"]}') for d in data[:3]]")
echo ""

# 4. POST /api/news/:id/like
echo "[4] POST /api/news/1/like"
STATUS=$(curl -s -o /tmp/test_like.json -w "%{http_code}" -X POST "$BASE/api/news/1/like")
assert_status "点赞新闻" 200 "$STATUS"
LIKES=$(python3 -c "import json; print(json.load(open('/tmp/test_like.json'))['likes'])")
echo "  → 当前点赞数: $LIKES"
echo ""

# 5. POST /api/news/:id/comment
echo "[5] POST /api/news/1/comment"
STATUS=$(curl -s -o /tmp/test_comment.json -w "%{http_code}" \
  -X POST "$BASE/api/news/1/comment" \
  -H "Content-Type: application/json" \
  -d '{"user":"测试用户","text":"这是一条自动化测试评论"}')
assert_status "发表评论" 200 "$STATUS"
python3 -c "import json; d=json.load(open('/tmp/test_comment.json')); print(f'  → 评论ID: {d[\"id\"]}, 用户: {d[\"user\"]}')"
echo ""

# 6. POST /api/news/crawl - simulate crawling
echo "[6] POST /api/news/crawl"
STATUS=$(curl -s -o /tmp/test_crawl.json -w "%{http_code}" -X POST "$BASE/api/news/crawl")
assert_status "模拟爬取新闻" 200 "$STATUS"
COUNT=$(python3 -c "import json; print(len(json.load(open('/tmp/test_crawl.json'))))")
echo "  → 新增 $COUNT 条新闻"
echo ""

# 7. GET /api/sample-data
echo "[7] GET /api/sample-data"
STATUS=$(curl -s -o /tmp/test_sample.json -w "%{http_code}" "$BASE/api/sample-data")
assert_status "获取样本数据" 200 "$STATUS"
COUNT=$(python3 -c "import json; print(len(json.load(open('/tmp/test_sample.json'))))")
echo "  → 返回 $COUNT 个数据点"
echo ""

# 8. POST /api/analyze - CSV upload
echo "[8] POST /api/analyze (CSV regression)"
printf 'pm25,disease_rate\n12,1.2\n25,2.0\n35,2.5\n50,3.8\n68,4.2\n80,5.1\n95,5.8\n40,2.9\n55,3.5\n30,1.8' > /tmp/test_analyze.csv
STATUS=$(curl -s -o /tmp/test_analyze.json -w "%{http_code}" \
  -X POST "$BASE/api/analyze" \
  -F "file=@/tmp/test_analyze.csv")
assert_status "CSV回归分析" 200 "$STATUS"
python3 -c "
import json
d = json.load(open('/tmp/test_analyze.json'))
s = d['summary']
print(f'  → 样本数: {s[\"n\"]}')
print(f'  → 斜率(pm25): {s[\"coefficients\"][\"pm25\"]:.4f}')
print(f'  → 截距: {s[\"coefficients\"][\"intercept\"]:.4f}')
print(f'  → R²: {s[\"rSquared\"]:.4f}')
print(f'  → P值: {s[\"pValue\"]}')
"
echo ""

# 9. POST /api/analyze - missing file
echo "[9] POST /api/analyze (no file - expect error)"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/analyze")
assert_status "无文件上传返回400" 400 "$STATUS"
echo ""

# 10. POST /api/news/999/like - not found
echo "[10] POST /api/news/999/like (not found)"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/news/999/like")
assert_status "不存在ID返回404" 404 "$STATUS"
echo ""

# Summary
echo "========================================"
echo " 测试结果: $PASS 通过, $FAIL 失败"
echo "========================================"
exit $FAIL
