# LiquidScale React Client

This is the official React library to interact with the LiquidScale.Cloud state engine. It provides a context as well as easy to use hooks to query and mutate your state, with full support for scopes and automatic query syncing between all clients.

## Getting Started

`npm install @liquidscale/react-client`

> Our modules are deployed in github for now, you need to configure github registry in your `~/.npmrc` file like this:

```
//registry.npmjs.org/:_authToken={your-auth-token}
//npm.pkg.github.com/:_authToken={your-auth-token}
@liquidscale:registry=https://npm.pkg.github.com/
```

This will instruct npm to retrieve all @liquidscale packages from github automatically for all your projects.

## Setting up LQS Backend Context

```jsx
import { LQSContextProvider } from "@liquidscale/react-client";

<LQSContextProvider url='{process.env.REACT_APP_SERVER_URL}'>
  <Container>
    <Router>
      <RouteMap />
    </Router>
  </Container>
</LQSContextProvider>;
```

The **LQSContextProvider** establishes the WebSocket connection to the backend so that all children components can use the various LQS hooks described below.

## Using Context Directly

```jsx
import { LQSContext } from "@liquidscale/react-client";

export function TodoList() {
  const { backend, query, connected, error, setError, act, token, auth, signOut } = useContext(LQSContext);
  return connected ? <div>I'm Alive</div> : <div>Not Connected!</div>;
}
```

The backend exposes a number of high and low level components that you can use in your React components depending on your use-case.

### Backend

The backend represents the [WebSocket Subject](https://rxjs.dev/api/webSocket/webSocket) to receive and send messages directly to your LQS backend. Messages are received by subscribing to the backend, while they are sent using the `next` method. You can apply all RxJS operators and strategies to perform whatever logic you need on incoming events.

```js
// low-level event handling. (not recommended)
backend.pipe(filter(e => e.type === "result")).subscribe(event => console.log("handling event", event));

// low-level action sending (not recommended)
backend.next({ action: "A120", data: {} });
```

As a rule of thumb, you should never use the backend directly but use the higher level hooks like `useQuery` and `useAction` or `query` and `act`.

### connected

boolean value indicating the state of your backend connection. Can be used to control React rendering of certain components (like connection indicator!)

### error, setError

error will be set to any received errors from the backend. Right now, only the last error is available, but this might become a list in the future. setError let you force an error to show to your user, reusing the LQS error management logic. In normal situation, setError is mostly used to remove an error after a timeout (setError(null)).

### token, setToken, auth, signOut

LQSContext manages one JWT token, which will be associated to the socket connection to perform secure authenticated operations. You can use internal LQS authentication mechanism to generate the token or you could use your own infrastructure (like SSO) and pass the token to LQS using the setToken method. In any case, the token variable will contain the current token while the `auth` variable is a boolean indicating if the user is authenticated or not (convenience, computed from token).

signOut is a method that can be called to delete the token and thus, close the secure session. The backend connection will not be closed and the token won't be revoked for now. So if the token is somewhere else in memory (which should not happen), it might be reusable after signout. be careful.

### query

`query` is a method to execute and track a query in your backend. It is simpler than using `backend` directly, but more complex than using `useQuery` hook. For most of time, you should use `useQuery` instead unless you have very specific needs.

```js
function query(scope, selector, expression, options = {}) {
  ...
}
```

- **scope**: the key of the scope you target. Queries always target one scope (required).
- **selector**: select is a [json-path expression](https://goessner.net/articles/JsonPath/) to target a specific node in your state tree. Will default to '$' which means target all the state tree
- **expression**: A mongo-like query object with which you can select collection elements. Expressions should be used only when you target a collection (in combination with the selector).
- **options**: options are applied to the query execution. [sync (true), single (false), sort (null), skip (0), limit (1000)].

The query function returns an array: [id, stream]. You can use the stream to monitor the query results. complete will be called if the query sync option is set to false. The stream is a normal RxJS observable.

### act

This is a method provided to manually execute an action in your LQS backend. Most of the time, you should use the `useAction` hook as it provides a better integration with React and provide action tracking for free.

```js
function act({ key, data }, { onError, onSuccess } = {}) {}
```

1st argument is an object containing the action key and an _optional_ payload. If you provide the data, the action will be triggered immediately if not, it will be deferred, providing a function to call with the data when you have it. This is very convenient as you can declare your actions with your components (using the hook) and execute them when a button is clicked or other user-driven actions.

It returns a number of indicators and functions depending on if it was immediate or not:

- **Immediate**: [{ connected, error, id, setError }, subcription] - subscription is the RxJS subcription that should be unsubcribe when you don't need the action anymore
- **deferred**: [execute, { connected, error, id, setError }] - execute will return a subscription when called.

## Hooks

Hooks are high level components that can be used inside your React apps for common interactions with your LQS backend. All interactions in LQS are either an action or a query, so with two flexible hooks, we cover about 95% of the needs. Other needs like error management, authentication can be handled using our provided methods or indicators.

Let's use the Chatrooms component in our [React chatroom sample App](https://github.com/liquidscale/sample-chatroom-react-app) to showcase how to use our query and action hooks.

```js
export function Chatrooms({ user }) {
  const history = useHistory();
  const [chatrooms, { loading, error }] = useQuery("lqs/chatroom", "$.rooms");
  const [joinRoom] = useAction("chatroom/join");

  const onJoin = (user, id) => {
    const colorIdx = Math.floor(Math.random() * colors.length);
    joinRoom(
      { username: user.username, id, color: colors[colorIdx], bgColor: bgColors[colorIdx] },
      {
        onSuccess() {
          console.log("join has been successfully received by lqs runtime");
          history.push(`/rooms/${id}`);
        },
      }
    );
  };

  return (
    <div className='mt-5'>
      <p>Here are the list of active chatrooms you're involved.</p>
      <Loading loading={loading} description='Loading visible chatrooms' />
      <ErrorMessage error={error} />
      {chatrooms && (
        <ul className='divide-y divide-gray-200'>
          {chatrooms.length === 0 && <p className='p-3 text-lg bg-amber-200 text-amber-700 rounded-lg my-3 text-center font-medium'>You don't have access to any chatrooms...</p>}
          {chatrooms.map(chatroom => (
            <Chatroom key={chatroom.id} onJoin={onJoin} user={user} {...chatroom} />
          ))}
        </ul>
      )}
    </div>
  );
}
```

### useAction

Use action is using the `act` method underneath, in deferred mode. You just declare your action and connect the provided execute function to your UI components. Here's a simple example taken from our chatroom sample

```js
const [joinRoom] = useAction("chatroom/join");
```

On this line, we declare our action, connecting it with our Chatrooms component. It will be called from our child Chatroom component when the user click on a specific room to join it. As you can see, nothing really special here. LQS will imply the actual scope and the right reducers and effects to apply based on your backend scope and action configuration. On the client, you just need to call the execute method (named joinRoom here) to trigger the action and send the right payload.

```js
const onJoin = (user, id) => {
  const colorIdx = Math.floor(Math.random() * colors.length);
  joinRoom(
    { username: user.username, id, color: colors[colorIdx], bgColor: bgColors[colorIdx] },
    {
      onSuccess() {
        console.log("join has been successfully received by lqs runtime");
        history.push(`/rooms/${id}`);
      },
    }
  );
};
```

### useQuery

`useQuery` is a hook exposing the features of `query` method, with easy integration with your React components. The parameters are the same than the `query` method, but the return value is a bit different:

```js
const [chatrooms, { loading, error }] = useQuery("lqs/chatroom", "$.rooms");

// [ data, { loading, connected, error, closed, token, auth } ]
```

The first parameter is the query result. Using _deconstruction_, you can provide the name you want for this variable. For sync queries, the result will change in real-time, triggering a re-render of your components accordingly. This means that any **meaningful** actions applied (reduced) in your scope or one of its subscribed scopes, will trigger a refresh of you sync query, automatically.

The second parameter are various indicators inherited from the context or specific to the query (closed, error, loading), which can be used in your component.

## Scopes

Scopes are data segments in the backend. Each scope has its own set of access permissions and contain versioned data model.

### Builtin Scopes

- **world**: shared by all systems (organization level? )
- **cluster**: shared by all systems to access low-level cluster infos like nodes, services, metrics, etc.
- **security**: used to maintain security state like users, roles, permissions, etc.
- **system**: available within the system (permission applies)
- **client**: available only to a specific client (app) within a given system
- **user**: infos owned by a specific user. only this user (proven with token) will sync this
- **device**: device specific data, only accessible from a specific device (by the same user)

### Custom Scopes

You can declare any number of scopes in your LQS backend. You just need to pass their unique key when performing actions or queries and LQS will handle the rest.
