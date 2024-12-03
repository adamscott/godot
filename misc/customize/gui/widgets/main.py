from textual.app import ComposeResult
from textual.widgets import Static

from .editor import Editor
from .sidebar import Sidebar


class Main(Static):
    def compose(self) -> ComposeResult:
        yield Sidebar(id="sidebar")
        yield Editor(id="editor")
