.PHONY: dev check install logs stats clean db clean-db

dev:
	@if [ ! -d node_modules ]; then npm install; fi
	@echo ""
	@echo "DiscoverPlace -> http://localhost:3000  (Ctrl+C pour arreter)"
	@echo ""
	npx next dev

check:
	npm run typecheck
	npm run lint
	npm run test
	npm run build
	@echo ""
	@echo "Tout est bon."

install:
	npm install

logs:
	npx tsx --env-file=.env.local scripts/analyze-logs.ts; true

stats:
	npx tsx --env-file=.env.local scripts/stats-engine.ts; true

clean:
	rm -rf .next tsconfig.tsbuildinfo test-results

clean-db:
	npx tsx --env-file=.env.local scripts/clean-db.ts; true
