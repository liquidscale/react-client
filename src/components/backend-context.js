/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from "react";
import { enablePatches } from "immer";
import SocketIO from "socket.io-client";
import { EventEmitter } from "fbemitter";
import { useLocalStorage } from "react-use";
import shortid from "shortid-36";

const BackendContext = React.createContext();

enablePatches();

const subscriptionFactory = (socket, builder, cleaner) => {
  const instance = new EventEmitter();

  instance.unsubscribe = function () {
    socket.emit("unsubscribe", { id: this.id }, cleaner);
  };

  setTimeout(() => {
    try {
      function factory(subscriptionId) {
        console.log("creating subscription ", subscriptionId);
        instance.id = subscriptionId;
        socket.on(subscriptionId, function ({ key, payload }) {
          instance.emit(key, payload);
        });
        socket.emit("subscribe", subscriptionId);
      }
      builder(factory);
    } catch (err) {
      instance.emit("error", err);
    }
  }, 0);

  return instance;
};

const backendFactory = socket => {
  return {
    async act(scope, type, data, handler) {
      socket.emit("act", { type, scope, data }, handler);
    },
    query(queryExpr, params = [], handler, opts) {
      const options = opts || {};
      if (options.sync !== false) {
        return subscriptionFactory(
          socket,
          function (factory) {
            socket.emit("query", { params, query: queryExpr, scope: options.scope, sortOrder: options.sortOrder, paging: options.paging, sync: true, single: options.single }, factory);
          },
          function (id) {
            socket.emit("close-query", { id });
          }
        );
      } else {
        socket.emit("query", { params, query: queryExpr, scope: options.scope, sortOrder: options.sortOrder, paging: options.paging, single: options.single }, handler);
      }
    },
    view(name, params = [], opts) {
      const options = opts || {};
      return subscriptionFactory(
        socket,
        function (factory) {
          socket.emit("open-view", { name, params, scope: options.scope, sortOrder: options.sortOrder, height: options.height, paging: options.paging, sync: true }, factory);
        },
        function (id) {
          socket.emit("close-view", { id });
        }
      );
    },
  };
};

function BackendContextProvider({ children, url, token, name, onForbidden }) {
  const [deviceId, setDeviceId] = useLocalStorage(name || "lqsdid");
  const [socket, setSocket] = useState();
  const [connected, setConnected] = useState();
  const [error, setError] = useState();
  const [backend, setBackend] = useState();

  useEffect(() => {
    if (!deviceId) {
      setDeviceId(shortid.generate());
    }
  }, []);

  useEffect(() => {
    if (url && deviceId) {
      console.log("connecting websocket to backend", url);
      const s = SocketIO(url, {
        "reconnection delay": 0,
        "reopen delay": 0,
        "force new connection": true,
        query: `id_token=${token}&did=${deviceId}`,
        transports: ["websocket"],
      });
      s.on("connect", function () {
        setSocket(s);
        setConnected(true);
      });
      s.on("disconnect", function () {
        setConnected(false);
      });
      s.on("reconnect", function () {
        setConnected(true);
      });
      s.on("client-error", function (err) {
        console.log("received error", err);
        setError(err);
        setTimeout(() => setError(null), 5000);
      });
      s.on("forbidden", function () {
        if (onForbidden) {
          onForbidden();
        } else {
          console.log("received forbidden... let's reload");
          window.location.reload();
        }
      });
    }
  }, [url, deviceId]);

  const value = { socket, connected, error, backend };

  React.useEffect(() => {
    if (socket) {
      setBackend(backendFactory(socket));
    }
  }, [socket]);

  return backend ? <BackendContext.Provider value={value}>{children}</BackendContext.Provider> : null;
}

const BackendContextConsumer = BackendContext.Consumer;

export { BackendContextConsumer, BackendContext, BackendContextProvider };
