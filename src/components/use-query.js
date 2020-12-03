/* eslint-disable react-hooks/exhaustive-deps */
import { useContext, useEffect, useState } from "react";
import { BackendContext } from "./backend-context";
import isEqual from "react-fast-compare";

export function useQuery(queryExpr, initialParams, initialOptions) {
  const { backend, connected } = useContext(BackendContext);

  const [data, setData] = useState();
  const [total, setTotal] = useState();
  const [error, setError] = useState();
  const [params, setParams] = useState(initialParams);
  const [options, setOptions] = useState(initialOptions);
  const [subscription, setSubscription] = useState();

  useEffect(() => {
    if (typeof options.active !== "undefined") {
      if (typeof options.active === "function") {
        if (options.active()) {
          setSubscription(backend.query(queryExpr, params, null, options));
        }
      } else if (options.active) {
        setSubscription(backend.query(queryExpr, params, null, options));
      }
    } else {
      setSubscription(backend.query(queryExpr, params, null, options));
    }
  }, [options, params, queryExpr]);

  useEffect(() => {
    if (!isEqual(options, initialOptions)) {
      setOptions(initialOptions);
    }
    if (!isEqual(params, initialParams)) {
      setParams(initialParams);
    }
  }, [initialParams, initialOptions]);

  useEffect(() => {
    if (subscription) {
      const listeners = [];
      listeners.push(
        subscription.addListener("data", ({ data, total }) => {
          setData(data);
          setTotal(total);
        }),
        subscription.addListener("error", function (err) {
          console.error(err);
          setError(err);
        })
      );
      return function () {
        listeners.forEach(l => l.remove());
        subscription.unsubscribe();
      };
    }
  }, [subscription]);

  return { data, total, connected, error };
}
