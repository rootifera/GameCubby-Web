# 0) Make sure .gitignore is sane
cat > .gitignore <<'EOF'
# dependencies
node_modules/

# next.js build
.next/
out/

# logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
*.log

# env
.env*
!.env.example

# misc
.DS_Store
EOF

# 1) Move HEAD back to the remote base, but keep your changes staged
#    (use the SHA you showed for origin/main)
git reset --soft 50858980286e931e4db5290143d59ff364f0fe66

# 2) Untrack all, then re-add respecting .gitignore
git rm -r --cached .
git add .

# 3) One clean commit that contains your project WITHOUT node_modules/.next/out
git commit -m "initial: clean Next.js repo (no node_modules/.next/out)"

# 4) Force-push the rewritten history
git push --force-with-lease origin main
