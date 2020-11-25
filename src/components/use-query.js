import { useContext, useEffect, useState, useMemo } from "react";
import { BackendContext } from "./backend-context";
import isEqual from "react-fast-compare";

export function useQuery(queryExpr, initialParams = [], initialOptions = {}) {
  const { backend, connected } = useContext(BackendContext);

  const [data, setData] = useState();
  const [total, setTotal] = useState();
  const [error, setError] = useState();
  const [params, setParams] = useState(initialParams);
  const [options, setOptions] = useState(initialOptions);
  const subscription = useMemo(() => backend.query(queryExpr, params, null, options), [queryExpr, params, options, backend]);

  useEffect(() => {
    if (!isEqual(params, initialParams)) {
      setParams(initialParams);
    }
    if (!isEqual(options, initialOptions)) {
      setOptions(initialOptions);
    }
  }, [initialParams, initialOptions]);

  useEffect(() => {
    const listeners = [];
    if (subscription) {
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
  }, [subscription.id]);

  return { data, total, connected, error };
}
