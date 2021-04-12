import babel from "rollup-plugin-babel";
import commonjs from "rollup-plugin-commonjs";
import resolve from "rollup-plugin-node-resolve";
import replace from "rollup-plugin-replace";

const NODE_ENV = process.env.NODE_ENV || "development";
const outputFile = NODE_ENV === "production" ? "./lib/lqs.js" : "./lib/lqs-dev.js";

export default {
  input: "./src/main.js",
  output: {
    file: outputFile,
    format: "cjs",
  },
  plugins: [
    replace({
      "process.env.NODE_ENV": JSON.stringify(NODE_ENV),
    }),
    babel({
      exclude: "node_modules/**",
    }),
    resolve(),
    commonjs(),
  ],
  external: id => /^react/.test(id),
};
