import { useContext } from "react";
import { BackendContext } from "./backend-context";
import { isFunction } from "lodash";

export function useAction(key, scope) {
  const { backend, error, connected, socket } = useContext(BackendContext);

  return [
    async function perform(data, resultHandler) {
      if (isFunction(scope.id)) {
        scope.id = scope.id(data);
      }
      return backend.act(scope, key, data, resultHandler);
    },
    error,
    connected,
    socket,
  ];
}
