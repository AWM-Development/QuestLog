// @questlog/core has no bare-specifier consumers — every import reaches a
// specific module via the "./*" subpath export (e.g. "@questlog/core/db/index.js",
// "@questlog/core/services/entity.service.js"). This file exists only to
// satisfy package.json's "main"/"types"/exports["."] fields.
export {};
