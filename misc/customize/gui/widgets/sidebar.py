from textual.app import ComposeResult
from textual.widgets import Button, Rule, Static


class Sidebar(Static):
    def compose(self) -> ComposeResult:
        yield Button(id="overall_btn", classes="sidebar_button", label="Overall")
        yield Rule()
        yield Button(id="web_btn", classes="sidebar_button", label="Web")

    def on_button_pressed(self, event: Button.Pressed) -> None:
        self.log("on_button_pressed")
