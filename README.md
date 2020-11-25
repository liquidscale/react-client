# LiquidScale React Client

This is the official React library to interact with the LiquidScale.Cloud state engine. It provides a context as well as easy to use hooks to query and mutate your state, with full support for scopes and automatic query syncing between all clients.

## Getting Started

`npm install @liquidscale/react-client`

## Setting up LQS Backend Context

```jsx
import { BackendContextProvider } from "@liquidscale/react-client";

<BackendContextProvider url='{process.env.REACT_APP_SERVER_URL}' token='{token}'>
  <Container>
    <Router>
      <RouteMap />
    </Router>
  </Container>
</BackendContextProvider>;
```

The BackendContextProvider establish the WebSocket connection to the backend so that all children components can use the various LQS hooks described below.

### Auth Token

You can pass an optional authentication token to your state engine. This token is optional but assuming that you configured security in your LQS state engine, you will need to generate and pass the token here. You can use the `@liquidscale/react-auth-context` module to quickly wrap things up with OIDC authentication.

## Using Context Directly

```jsx
import { BackendContext } from "@liquidscale/react-client";

export function TodoList() {
  const { socket, connected, error, backend } = useContext(BackendContext);
  // you can access socket (socket.on, socket.emit)
  // connected is true|false depending on the socket connection state
  // error contain the latest error sent by the backend
  // backend provides low-level functions to interact with the LQS functional backend (see below)

  return connected ? <div>I'm Alive</div> : <div>Not Connected!</div>;
}
```

## Backend Service

- **act** : Perform an action in the backend.
- **query**: Execute a query in the backend. Query can stay connected to receive new results when server detects applicable changes.

## Hooks

### useAction

You can use useAction to inject a simple function in any component where you need to trigger backend actions:

```js
export function PostForm({ chatroom, username }) {
  const [form] = Form.useForm();
  const [message, setMessage] = useState();
  const [post] = useAction("post/message", { type: "group", key: "room", id: data => data.name });
  const handlePostMessage = () => {
    post({ name: chatroom, message, username });
    form.resetFields();
  };

  return (
    <Form form={form}>
      <Form.Item name='message'>
        <Input.TextArea disabled={!chatroom} placeholder='Type message content' rows={2} onChange={e => setMessage(e.target.value)} />
      </Form.Item>
      <Form.Item>
        <Button disabled={!chatroom} type='primary' block onClick={handlePostMessage}>
          Post Message to
          <strong> {chatroom}</strong>
        </Button>
      </Form.Item>
    </Form>
  );
}
```

You can now use the `post` function just like any other actions. This will trigger a backend action in the scope group:room:{id}.

### useQuery

This hook is used to connect a query to your component. The component will be automatically rendered when the query result changed in the state engine unless you specific `sync:false` in the options.

```js
export function Messages({ chatroom }) {
  const { data: messages } = useQuery("messages", [], { scope: { type: "group", key: "room", id: chatroom }, sortOrder: { ts: -1 } });

  return (
    <div>
      {messages &&
        messages.map(msg => (
          <p key={msg.ts}>
            {msg.username} - {msg.message} - {msg.ts}
          </p>
        ))}
    </div>
  );
}
```

It provides these fields `{ data, total, connected, error }`.

The first parameter is a query expression, which by default is a JSONPath expression, without the $. at the start, which is implied. [https://goessner.net/articles/JsonPath/](https://goessner.net/articles/JsonPath/)

## Scopes

Scopes are data segments in the backend. Each scope has its own set of access permissions and contain versioned data model.

- **world**: shared by all systems (organization level? )
- **system**: available within the system (permission applies)
- **security**: used to maintain security state like users, roles, permissions, etc.
- **client**: available only to a specific client (app) within a given system
- **group**: analog to a room in the system, only these users in the room will sync this scope
- **user**: infos owned by a specific user. only this user (proven with token) will sync this
- **device**: device specific data, only accessible from a specific device (by the same user)

The union of all accessible scope become the data model of the system for a specific user and device. Portion of this model can be cached on the device or
dynamically synced when changes happen. This is all supported out of the box by LQS.
