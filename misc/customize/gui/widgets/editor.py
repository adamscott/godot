from textual.app import ComposeResult
from textual.containers import VerticalScroll
from textual.widgets import ContentSwitcher

from .platforms import WebPlatform


class Editor(VerticalScroll):
    def compose(self) -> ComposeResult:
        with ContentSwitcher(initial="web"):
            yield WebPlatform(id="web")
