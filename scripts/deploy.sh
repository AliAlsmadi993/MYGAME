#!/bin/bash
# بيبني اللعبة وبينشرها على GitHub Pages (فرع gh-pages).
# الرابط: https://alialsmadi993.github.io/MYGAME/
set -e
cd "$(dirname "$0")/.."
npx vite build
touch dist/.nojekyll
tmp=$(mktemp -d)
cp -r dist/. "$tmp"
cd "$tmp"
git init -q -b gh-pages
git add -A
git commit -q -m "Deploy to GitHub Pages"
git push -f "$(cd - >/dev/null && git remote get-url origin)" gh-pages
rm -rf "$tmp"
echo "انتشرت: https://alialsmadi993.github.io/MYGAME/"
