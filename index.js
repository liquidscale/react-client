if (process.env.NODE_ENV === "production") {
  module.exports = require("./lib/lqs");
} else {
  module.exports = require("./lib/lqs-dev");
}
