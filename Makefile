.PHONY: dev check install logs stats

dev:
	@if [ ! -d node_modules ]; then npm install; fi
	@echo ""
	@echo "DiscoverPlace démarre sur http://localhost:3000"
	@echo "Ctrl+C pour arrêter."
	@echo ""
	@npm run dev

check:
	npm run typecheck
	npm run lint
	npm run test
	npm run build
	@echo ""
	@echo "Tout est bon. Le projet est prêt à être déployé."

install:
	npm install

logs:
	npx tsx --env-file=.env.local scripts/analyze-logs.ts

stats:
	npx tsx --env-file=.env.local scripts/stats-engine.ts
