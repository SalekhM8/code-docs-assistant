import json


def handle_request(body):
    """Parses a JSON body and routes it."""
    payload = json.loads(body)
    return Router().dispatch(payload["path"])


class Router:
    def dispatch(self, path):
        if path == "/health":
            return "ok"
        return "not found"
