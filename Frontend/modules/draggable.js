export function makeWindowDraggable(win) {
    let pos = { x: 0, y: 0 };

    const header = win.querySelector(".window-header");
    if (!header) return;

    header.style.cursor = "grab";

    header.onmousedown = e => {
        pos.x = e.clientX - win.offsetLeft;
        pos.y = e.clientY - win.offsetTop;

        document.onmousemove = ev => {
            win.style.left = ev.clientX - pos.x + "px";
            win.style.top = ev.clientY - pos.y + "px";
        };

        document.onmouseup = () => {
            document.onmousemove = null;
            document.onmouseup = null;
        };
    };
}
