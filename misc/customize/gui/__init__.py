from .app import CustomizeApp


def start() -> None:
    app = CustomizeApp()
    app.run()


__all__ = ["start"]
