from textual.app import ComposeResult
from textual.widgets import Static

from .platform import Platform


class WebPlatform(Platform):
    def compose(self) -> ComposeResult:
        yield Static()
