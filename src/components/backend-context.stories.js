import React from "react";
import { BackendContextProvider } from "./backend-context.js";

export default { title: "Backend Context Provider component" };

export const backendContextProvider = () => {
  return (
    <BackendContextProvider url='http://localhost:5000'>
      <div>Connected!</div>
    </BackendContextProvider>
  );
};
