/* eslint-disable react-hooks/exhaustive-deps */
import React, { useContext, useEffect, useMemo, useState } from "react";
import { webSocket } from "rxjs/webSocket";
import shortid from "shortid-36";
import { filter } from "rxjs/operators";
import isEqual from "react-fast-compare";
import { useSessionStorage } from "react-use";

const LQSContext = React.createContext();

function LQSContextProvider({ children, url }) {
  const [backend, setBackend] = useState();
  const [connected, setConnected] = useState(false);
  const [token, setToken] = useSessionStorage("lqs_token", null, true);
  const [error, setError] = useState();
  const auth = useMemo(() => token != null, [token]);

  function query(scope, selector, expression, options = {}) {
    const id = shortid.generate();
    return {
      id,
      $: backend.multiplex(
        () => ({ query: id, op: "open", scope, selector, expression, options, token }),
        () => ({ query: id, op: "close", token }),
        msg => msg.sid === id
      ),
    };
  }

  function act({ key, data }, { onError, onSuccess } = {}) {
    const id = shortid.generate();
    if (!connected && data) {
      console.log("not connected. cannot executed direct action");
      return [{ connected, error, id, setError }];
    }

    if (data) {
      let sub = null;
      if (onError || onSuccess) {
        sub = backend.pipe(filter(msg => msg.sid === id)).subscribe(msg => {
          if (msg.type === "error") {
            onError && onError(msg.error);
          } else {
            onSuccess && onSuccess(msg);
          }
        });
      }
      backend.next({ action: id, key, data, token });
      return [{ connected, error, id, setError }, sub];
    } else {
      return [
        function execute(data, { onError, onSuccess } = {}) {
          setError(null);
          let sub = null;
          if (onError || onSuccess) {
            sub = backend.pipe(filter(msg => msg.sid === id)).subscribe(msg => {
              if (msg.type === "error") {
                onError && onError(msg.error);
              } else {
                onSuccess && onSuccess(msg);
              }
            });
          }
          const payload = { action: id, key, data };
          if (token && token != null) {
            payload.token = token;
          }
          backend.next(payload);
          return sub;
        },
        { connected, error, id, setError },
      ];
    }
  }

  useEffect(() => {
    if (url) {
      const backendSubject = webSocket({
        url,
        openObserver: { next: () => setConnected(true) },
        closeObserver: { next: () => setConnected(false) },
      });
      setBackend(backendSubject);
      const subscription = backendSubject.subscribe(msg => {
        setError(null);
        if (msg.error) {
          if (msg.error.code === 403) {
            console.log("token is either expired or invalid. let's force a new signin");
            setToken(null);
            setError(null);
          } else {
            console.log("received backend error", msg.error);
            setError(msg.error);
          }
        } else if (msg.type === "auth") {
          setToken(msg.data.token);
        }
      });
      return function () {
        if (subscription) {
          subscription.unsubscribe();
        }
      };
    }
  }, [url]);

  function signOut() {
    setToken(null);
  }

  const value = { backend, query, connected, error, setError, act, token, setToken, auth, signOut };

  return <LQSContext.Provider value={value}>{children}</LQSContext.Provider>;
}

function useAction(key) {
  const { act, connected, auth } = useContext(LQSContext);
  return useMemo(() => act({ key }), [connected, auth]);
}

function useQuery(scope, initialSelector, initialExpr, initialOptions) {
  const [options, setOptions] = useState();
  const [expr, setExpression] = useState();
  const [selector, setSelector] = useState();
  const { query, connected, token, auth, error, setError } = useContext(LQSContext);
  const [loading, setLoading] = useState(true);
  const [closed, setClosed] = useState(false);
  const [data, setData] = useState();

  useEffect(() => {
    if (!isEqual(initialSelector, selector)) {
      setSelector(initialSelector);
    }
  }, [initialSelector]);

  useEffect(() => {
    if (!isEqual(initialExpr, expr)) {
      setExpression(initialExpr);
    }
  }, [initialExpr]);

  useEffect(() => {
    if (!isEqual(initialOptions, options)) {
      setOptions(initialOptions);
    }
  }, [initialOptions]);

  useEffect(() => {
    if (!connected || !token) {
      setLoading(false);
      return;
    }

    setError(null);
    const q = query(scope, selector, expr, options);

    const subscription = q.$.subscribe(
      msg => {
        switch (msg.type) {
          case "result":
            setLoading(false);
            setData(msg.data);
            break;
          case "error":
            setLoading(false);
            setError(msg.error);
            break;
          case "ack":
            break;
          default:
            console.log("received unsupported message", msg);
            setError({ message: "unsupported lqs message" });
            break;
        }
      },
      error => {
        console.log("query %s error", q.id, error);
        setLoading(false);
        setError(error);
      },
      () => {
        console.log("query %s is closed", q.id);
        setLoading(false);
        setClosed(true);
      }
    );

    return function () {
      subscription.unsubscribe();
    };
  }, [scope, selector, expr, options, connected, token]);

  return [
    data,
    {
      loading,
      connected,
      error,
      closed,
      token,
      auth,
    },
  ];
}

const LQSContextConsumer = LQSContext.Consumer;

export { LQSContext, LQSContextConsumer, LQSContextProvider, useAction, useQuery };
