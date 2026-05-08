const {
  loadEnums,
  loadSourceRegistry,
  sourceRegistryPath,
  validateSourceRegistry
} = require("./lib/kb");

const result = validateSourceRegistry(loadSourceRegistry(), loadEnums());

for (const warning of result.warnings) {
  console.warn(`WARN ${warning}`);
}

if (result.errors.length > 0) {
  for (const error of result.errors) {
    console.error(`ERROR ${error}`);
  }
  process.exit(1);
}

console.log(`OK sources validated: ${sourceRegistryPath}`);
