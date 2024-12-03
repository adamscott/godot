from textual.app import App, ComposeResult
from textual.widgets import Footer, Header

from .widgets import Main


class CustomizeApp(App):
    """A GUI to create custom.py"""

    TITLE = "customize.py"
    BINDINGS = [("d", "toggle_dark", "Toggle dark mode"), ("q", "request_quit", "Quit")]
    CSS_PATH = "tcss/main.tcss"

    def compose(self) -> ComposeResult:
        """Create child widgets for the app."""
        yield Header()
        yield Main(id="main")
        yield Footer()

    def action_request_quit(self) -> None:
        self.app.exit()
