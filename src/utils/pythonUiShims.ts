export const FLET_PYTHON_SHIM = String.raw`
import sys
import asyncio
import inspect
from js import document, window, console
from pyodide.ffi import create_proxy

_COLORS = {
    "BLUE": "#2563eb", "BLUE_500": "#3b82f6", "BLUE_600": "#2563eb", "BLUE_100": "#dbeafe",
    "RED": "#dc2626", "RED_500": "#ef4444", "RED_600": "#dc2626", "RED_100": "#fee2e2",
    "GREEN": "#16a34a", "GREEN_500": "#22c55e", "GREEN_600": "#16a34a", "GREEN_100": "#dcfce7",
    "AMBER": "#d97706", "AMBER_500": "#f59e0b", "ORANGE": "#ea580c", "PURPLE": "#9333ea",
    "INDIGO": "#4f46e5", "TEAL": "#0d9488", "CYAN": "#0891b2", "PINK": "#db2777",
    "WHITE": "#ffffff", "BLACK": "#000000", "TRANSPARENT": "transparent",
    "GREY": "#6b7280", "GRAY": "#6b7280", "GREY_100": "#f3f4f6", "GREY_200": "#e5e7eb",
    "GREY_300": "#d1d5db", "GREY_700": "#374151", "GREY_800": "#1f2937", "GREY_900": "#111827",
    "SURFACE_VARIANT": "rgba(128,128,128,0.12)", "ON_SURFACE_VARIANT": "#71717a",
    "PRIMARY": "#2563eb", "ON_PRIMARY": "#ffffff",
}

def _resolve_color(c):
    if c is None:
        return None
    s = str(c).strip()
    if s.startswith("#") or s.startswith("rgb") or s.startswith("hsl"):
        return s
    up = s.upper().replace("COLORS.", "").replace("FT.COLORS.", "")
    return _COLORS.get(up, s.lower())

class _ColorNamespace:
    def __getattr__(self, name):
        return _COLORS.get(name.upper(), name.lower())

Colors = _ColorNamespace()
colors = Colors

class _IconNamespace:
    def __getattr__(self, name):
        return name.lower()

Icons = _IconNamespace()
icons = Icons

class FontWeight:
    NORMAL = "400"
    W_400 = "400"
    W_500 = "500"
    W_600 = "600"
    BOLD = "700"
    W_700 = "700"

class MainAxisAlignment:
    START = "flex-start"
    CENTER = "center"
    END = "flex-end"
    SPACE_BETWEEN = "space-between"
    SPACE_AROUND = "space-around"
    SPACE_EVENLY = "space-evenly"

class CrossAxisAlignment:
    START = "flex-start"
    CENTER = "center"
    END = "flex-end"
    STRETCH = "stretch"

class TextAlign:
    LEFT = "left"
    CENTER = "center"
    RIGHT = "right"
    JUSTIFY = "justify"

class ThemeMode:
    SYSTEM = "system"
    LIGHT = "light"
    DARK = "dark"

class ScrollMode:
    AUTO = "auto"
    ADAPTIVE = "auto"
    ALWAYS = "scroll"
    HIDDEN = "hidden"

class alignment:
    center = "center"
    top_left = "flex-start"
    top_center = "center"
    bottom_center = "center"

class padding:
    @staticmethod
    def all(v):
        return f"{v}px"
    @staticmethod
    def symmetric(vertical=0, horizontal=0):
        return f"{vertical}px {horizontal}px"
    @staticmethod
    def only(left=0, top=0, right=0, bottom=0):
        return f"{top}px {right}px {bottom}px {left}px"

margin = padding

class border:
    @staticmethod
    def all(width=1, color="#cbd5e1"):
        return f"{width}px solid {_resolve_color(color)}"

class BorderRadius:
    @staticmethod
    def all(r):
        return f"{r}px"

border_radius = BorderRadius

class dropdown:
    class Option:
        def __init__(self, key=None, text=None):
            self.key = key if key is not None else text
            self.text = text if text is not None else str(key)

_active_proxies = []
_next_id = 1

def _gen_id():
    global _next_id
    val = f"ft-{_next_id}"
    _next_id += 1
    return val

class ControlEvent:
    def __init__(self, control, page, data=None):
        self.control = control
        self.page = page
        self.data = data

def _invoke_cb(cb, ev):
    if cb is None:
        return
    try:
        res = cb(ev)
        if inspect.isawaitable(res):
            asyncio.ensure_future(res)
    except Exception as ex:
        console.error(f"Flet callback error: {ex}")

class Control:
    def __init__(self, **kwargs):
        self._id = _gen_id()
        self.visible = kwargs.get("visible", True)
        self.disabled = kwargs.get("disabled", False)
        self.expand = kwargs.get("expand", False)
        self.width = kwargs.get("width", None)
        self.height = kwargs.get("height", None)
        self.tooltip = kwargs.get("tooltip", None)
        self._page = None

    def update(self):
        if _current_page is not None:
            _current_page.update()

    def _apply_common(self, el):
        el.dataset.fid = self._id
        if not self.visible:
            el.style.display = "none"
        if self.expand:
            el.style.flex = "1"
        if self.width is not None:
            el.style.width = f"{self.width}px" if isinstance(self.width, (int, float)) else str(self.width)
        if self.height is not None:
            el.style.height = f"{self.height}px" if isinstance(self.height, (int, float)) else str(self.height)
        if self.tooltip:
            el.title = str(self.tooltip)

class Text(Control):
    def __init__(self, value="", size=None, weight=None, color=None, italic=False, text_align=None, selectable=False, **kwargs):
        super().__init__(**kwargs)
        self.value = value
        self.size = size
        self.weight = weight
        self.color = color
        self.italic = italic
        self.text_align = text_align
        self.selectable = selectable

    def _render(self, page):
        el = document.createElement("div")
        el.className = "ft-text"
        el.textContent = "" if self.value is None else str(self.value)
        if self.size:
            el.style.fontSize = f"{self.size}px"
        if self.weight:
            el.style.fontWeight = str(self.weight)
        if self.color:
            el.style.color = _resolve_color(self.color)
        if self.italic:
            el.style.fontStyle = "italic"
        if self.text_align:
            el.style.textAlign = str(self.text_align)
        self._apply_common(el)
        return el

class Markdown(Control):
    def __init__(self, value="", **kwargs):
        super().__init__(**kwargs)
        self.value = value

    def _render(self, page):
        el = document.createElement("pre")
        el.className = "ft-markdown"
        el.textContent = str(self.value or "")
        self._apply_common(el)
        return el

class Icon(Control):
    def __init__(self, name="star", color=None, size=20, **kwargs):
        super().__init__(**kwargs)
        self.name = name
        self.color = color
        self.size = size

    def _render(self, page):
        el = document.createElement("span")
        el.className = "material-symbols-rounded ft-icon"
        el.textContent = str(self.name or "circle").lower()
        if self.size:
            el.style.fontSize = f"{self.size}px"
        if self.color:
            el.style.color = _resolve_color(self.color)
        self._apply_common(el)
        return el

class Image(Control):
    def __init__(self, src="", width=None, height=None, border_radius=None, **kwargs):
        super().__init__(width=width, height=height, **kwargs)
        self.src = src
        self.border_radius = border_radius

    def _render(self, page):
        el = document.createElement("img")
        el.src = str(self.src or "")
        el.style.maxWidth = "100%"
        el.style.objectFit = "cover"
        if self.border_radius:
            el.style.borderRadius = f"{self.border_radius}px" if isinstance(self.border_radius, (int, float)) else str(self.border_radius)
        self._apply_common(el)
        return el

class Divider(Control):
    def __init__(self, height=1, thickness=1, color=None, **kwargs):
        super().__init__(**kwargs)
        self.thickness = thickness
        self.color = color

    def _render(self, page):
        el = document.createElement("hr")
        el.className = "ft-divider"
        if self.color:
            el.style.borderColor = _resolve_color(self.color)
        self._apply_common(el)
        return el

class VerticalDivider(Divider):
    pass

class ProgressBar(Control):
    def __init__(self, value=None, color=None, bgcolor=None, **kwargs):
        super().__init__(**kwargs)
        self.value = value
        self.color = color
        self.bgcolor = bgcolor

    def _render(self, page):
        wrap = document.createElement("div")
        wrap.className = "ft-progress-track"
        if self.bgcolor:
            wrap.style.background = _resolve_color(self.bgcolor)
        fill = document.createElement("div")
        fill.className = "ft-progress-fill"
        pct = 100 if self.value is None else max(0, min(100, float(self.value) * 100))
        fill.style.width = f"{pct}%"
        if self.value is None:
            fill.classList.add("indeterminate")
        if self.color:
            fill.style.background = _resolve_color(self.color)
        wrap.appendChild(fill)
        self._apply_common(wrap)
        return wrap

class ProgressRing(Control):
    def __init__(self, value=None, color=None, **kwargs):
        super().__init__(**kwargs)
        self.color = color

    def _render(self, page):
        el = document.createElement("div")
        el.className = "ft-spinner"
        if self.color:
            el.style.borderTopColor = _resolve_color(self.color)
        self._apply_common(el)
        return el

class _BaseButton(Control):
    def __init__(self, text="", icon=None, on_click=None, bgcolor=None, color=None, style=None, content=None, variant="elevated", **kwargs):
        super().__init__(**kwargs)
        self.text = text
        self.icon = icon
        self.on_click = on_click
        self.bgcolor = bgcolor
        self.color = color
        self.content = content
        self.variant = variant

    def _render(self, page):
        btn = document.createElement("button")
        btn.type = "button"
        btn.className = f"ft-btn ft-btn-{self.variant}"
        btn.disabled = bool(self.disabled)
        if self.bgcolor:
            btn.style.background = _resolve_color(self.bgcolor)
        if self.color:
            btn.style.color = _resolve_color(self.color)
        if self.icon:
            ic = document.createElement("span")
            ic.className = "material-symbols-rounded"
            ic.style.fontSize = "18px"
            ic.textContent = str(self.icon).lower()
            btn.appendChild(ic)
        if self.content is not None and hasattr(self.content, "_render"):
            btn.appendChild(self.content._render(page))
        elif self.text:
            sp = document.createElement("span")
            sp.textContent = str(self.text)
            btn.appendChild(sp)
        if self.on_click:
            def _on_click(e):
                _invoke_cb(self.on_click, ControlEvent(self, page))
            p = create_proxy(_on_click)
            _active_proxies.append(p)
            btn.addEventListener("click", p)
        self._apply_common(btn)
        return btn

class ElevatedButton(_BaseButton):
    def __init__(self, text="", **kwargs):
        super().__init__(text=text, variant="elevated", **kwargs)

class FilledButton(_BaseButton):
    def __init__(self, text="", **kwargs):
        super().__init__(text=text, variant="filled", **kwargs)

class FilledTonalButton(_BaseButton):
    def __init__(self, text="", **kwargs):
        super().__init__(text=text, variant="tonal", **kwargs)

class OutlinedButton(_BaseButton):
    def __init__(self, text="", **kwargs):
        super().__init__(text=text, variant="outlined", **kwargs)

class TextButton(_BaseButton):
    def __init__(self, text="", **kwargs):
        super().__init__(text=text, variant="text", **kwargs)

class IconButton(_BaseButton):
    def __init__(self, icon="add", **kwargs):
        super().__init__(icon=icon, variant="icon", **kwargs)

class FloatingActionButton(_BaseButton):
    def __init__(self, icon="add", text="", **kwargs):
        super().__init__(text=text, icon=icon, variant="filled", **kwargs)

class TextField(Control):
    def __init__(self, label=None, value="", hint_text=None, password=False, multiline=False, read_only=False, on_change=None, on_submit=None, **kwargs):
        super().__init__(**kwargs)
        self.label = label
        self.value = "" if value is None else str(value)
        self.hint_text = hint_text
        self.password = password
        self.multiline = multiline
        self.read_only = read_only
        self.on_change = on_change
        self.on_submit = on_submit

    def _render(self, page):
        wrap = document.createElement("div")
        wrap.className = "ft-field"
        if self.label:
            lbl = document.createElement("label")
            lbl.className = "ft-field-label"
            lbl.textContent = str(self.label)
            wrap.appendChild(lbl)
        inp = document.createElement("textarea" if self.multiline else "input")
        if not self.multiline:
            inp.type = "password" if self.password else "text"
        inp.className = "ft-input"
        inp.dataset.fid = self._id
        inp.value = "" if self.value is None else str(self.value)
        if self.hint_text:
            inp.placeholder = str(self.hint_text)
        inp.readOnly = bool(self.read_only)
        inp.disabled = bool(self.disabled)

        def _on_input(e):
            self.value = e.target.value
            if self.on_change:
                _invoke_cb(self.on_change, ControlEvent(self, page, self.value))
        p_in = create_proxy(_on_input)
        _active_proxies.append(p_in)
        inp.addEventListener("input", p_in)

        if self.on_submit and not self.multiline:
            def _on_key(e):
                if e.key == "Enter":
                    _invoke_cb(self.on_submit, ControlEvent(self, page, self.value))
            p_k = create_proxy(_on_key)
            _active_proxies.append(p_k)
            inp.addEventListener("keydown", p_k)

        wrap.appendChild(inp)
        self._apply_common(wrap)
        return wrap

class Checkbox(Control):
    def __init__(self, label="", value=False, on_change=None, **kwargs):
        super().__init__(**kwargs)
        self.label = label
        self.value = bool(value)
        self.on_change = on_change

    def _render(self, page):
        lbl = document.createElement("label")
        lbl.className = "ft-check-row"
        inp = document.createElement("input")
        inp.type = "checkbox"
        inp.checked = bool(self.value)
        inp.disabled = bool(self.disabled)
        def _on_chg(e):
            self.value = bool(e.target.checked)
            if self.on_change:
                _invoke_cb(self.on_change, ControlEvent(self, page, self.value))
        p = create_proxy(_on_chg)
        _active_proxies.append(p)
        inp.addEventListener("change", p)
        lbl.appendChild(inp)
        if self.label:
            sp = document.createElement("span")
            sp.textContent = str(self.label)
            lbl.appendChild(sp)
        self._apply_common(lbl)
        return lbl

class Switch(Control):
    def __init__(self, label="", value=False, on_change=None, **kwargs):
        super().__init__(**kwargs)
        self.label = label
        self.value = bool(value)
        self.on_change = on_change

    def _render(self, page):
        lbl = document.createElement("label")
        lbl.className = "ft-check-row"
        inp = document.createElement("input")
        inp.type = "checkbox"
        inp.className = "ft-switch"
        inp.checked = bool(self.value)
        inp.disabled = bool(self.disabled)
        def _on_chg(e):
            self.value = bool(e.target.checked)
            if self.on_change:
                _invoke_cb(self.on_change, ControlEvent(self, page, self.value))
        p = create_proxy(_on_chg)
        _active_proxies.append(p)
        inp.addEventListener("change", p)
        lbl.appendChild(inp)
        if self.label:
            sp = document.createElement("span")
            sp.textContent = str(self.label)
            lbl.appendChild(sp)
        self._apply_common(lbl)
        return lbl

class Slider(Control):
    def __init__(self, min=0, max=100, divisions=None, value=0, label=None, on_change=None, **kwargs):
        super().__init__(**kwargs)
        self.min = min
        self.max = max
        self.divisions = divisions
        self.value = value
        self.label = label
        self.on_change = on_change

    def _render(self, page):
        wrap = document.createElement("div")
        wrap.className = "ft-slider-wrap"
        inp = document.createElement("input")
        inp.type = "range"
        inp.min = str(self.min)
        inp.max = str(self.max)
        if self.divisions:
            inp.step = str((self.max - self.min) / self.divisions)
        inp.value = str(self.value)
        inp.disabled = bool(self.disabled)
        val_span = document.createElement("span")
        val_span.className = "ft-slider-val"
        val_span.textContent = str(round(float(self.value), 2))
        def _on_in(e):
            self.value = float(e.target.value)
            val_span.textContent = str(round(self.value, 2))
            if self.on_change:
                _invoke_cb(self.on_change, ControlEvent(self, page, self.value))
        p = create_proxy(_on_in)
        _active_proxies.append(p)
        inp.addEventListener("input", p)
        wrap.appendChild(inp)
        wrap.appendChild(val_span)
        self._apply_common(wrap)
        return wrap

class Dropdown(Control):
    def __init__(self, label=None, value=None, options=None, on_change=None, **kwargs):
        super().__init__(**kwargs)
        self.label = label
        self.value = value
        self.options = options or []
        self.on_change = on_change

    def _render(self, page):
        wrap = document.createElement("div")
        wrap.className = "ft-field"
        if self.label:
            lbl = document.createElement("label")
            lbl.className = "ft-field-label"
            lbl.textContent = str(self.label)
            wrap.appendChild(lbl)
        sel = document.createElement("select")
        sel.className = "ft-input"
        for opt in self.options:
            o = document.createElement("option")
            o.value = str(opt.key)
            o.textContent = str(opt.text)
            if str(opt.key) == str(self.value):
                o.selected = True
            sel.appendChild(o)
        def _on_chg(e):
            self.value = e.target.value
            if self.on_change:
                _invoke_cb(self.on_change, ControlEvent(self, page, self.value))
        p = create_proxy(_on_chg)
        _active_proxies.append(p)
        sel.addEventListener("change", p)
        wrap.appendChild(sel)
        self._apply_common(wrap)
        return wrap

class Row(Control):
    def __init__(self, controls=None, spacing=10, alignment="flex-start", vertical_alignment="center", wrap=False, **kwargs):
        super().__init__(**kwargs)
        self.controls = list(controls or [])
        self.spacing = spacing
        self.alignment = alignment
        self.vertical_alignment = vertical_alignment
        self.wrap = wrap

    def _render(self, page):
        el = document.createElement("div")
        el.className = "ft-row"
        el.style.gap = f"{self.spacing}px"
        el.style.justifyContent = str(self.alignment or "flex-start")
        el.style.alignItems = str(self.vertical_alignment or "center")
        if self.wrap:
            el.style.flexWrap = "wrap"
        for c in self.controls:
            if c is not None and hasattr(c, "_render"):
                el.appendChild(c._render(page))
        self._apply_common(el)
        return el

class Column(Control):
    def __init__(self, controls=None, spacing=10, alignment="flex-start", horizontal_alignment="stretch", **kwargs):
        super().__init__(**kwargs)
        self.controls = list(controls or [])
        self.spacing = spacing
        self.alignment = alignment
        self.horizontal_alignment = horizontal_alignment

    def _render(self, page):
        el = document.createElement("div")
        el.className = "ft-col"
        el.style.gap = f"{self.spacing}px"
        el.style.justifyContent = str(self.alignment or "flex-start")
        el.style.alignItems = str(self.horizontal_alignment or "stretch")
        for c in self.controls:
            if c is not None and hasattr(c, "_render"):
                el.appendChild(c._render(page))
        self._apply_common(el)
        return el

ListView = Column

class Container(Control):
    def __init__(self, content=None, padding=None, margin=None, bgcolor=None, border_radius=None, border=None, alignment=None, on_click=None, **kwargs):
        super().__init__(**kwargs)
        self.content = content
        self.padding = padding
        self.margin = margin
        self.bgcolor = bgcolor
        self.border_radius = border_radius
        self.border = border
        self.alignment = alignment
        self.on_click = on_click

    def _render(self, page):
        el = document.createElement("div")
        el.className = "ft-container"
        if self.padding is not None:
            el.style.padding = f"{self.padding}px" if isinstance(self.padding, (int, float)) else str(self.padding)
        if self.margin is not None:
            el.style.margin = f"{self.margin}px" if isinstance(self.margin, (int, float)) else str(self.margin)
        if self.bgcolor:
            el.style.background = _resolve_color(self.bgcolor)
        if self.border_radius is not None:
            el.style.borderRadius = f"{self.border_radius}px" if isinstance(self.border_radius, (int, float)) else str(self.border_radius)
        if self.border:
            el.style.border = str(self.border)
        if self.alignment == "center":
            el.style.display = "flex"
            el.style.alignItems = "center"
            el.style.justifyContent = "center"
        if self.on_click:
            el.style.cursor = "pointer"
            def _on_c(e):
                _invoke_cb(self.on_click, ControlEvent(self, page))
            p = create_proxy(_on_c)
            _active_proxies.append(p)
            el.addEventListener("click", p)
        if self.content is not None and hasattr(self.content, "_render"):
            el.appendChild(self.content._render(page))
        self._apply_common(el)
        return el

class Card(Control):
    def __init__(self, content=None, color=None, **kwargs):
        super().__init__(**kwargs)
        self.content = content
        self.color = color

    def _render(self, page):
        el = document.createElement("div")
        el.className = "ft-card"
        if self.color:
            el.style.background = _resolve_color(self.color)
        if self.content is not None and hasattr(self.content, "_render"):
            el.appendChild(self.content._render(page))
        self._apply_common(el)
        return el

class Tab:
    def __init__(self, text="", content=None, **kwargs):
        self.text = text
        self.content = content

class Tabs(Control):
    def __init__(self, tabs=None, selected_index=0, on_change=None, **kwargs):
        super().__init__(**kwargs)
        self.tabs = list(tabs or [])
        self.selected_index = selected_index
        self.on_change = on_change

    def _render(self, page):
        wrap = document.createElement("div")
        wrap.className = "ft-tabs"
        bar = document.createElement("div")
        bar.className = "ft-tab-bar"
        for idx, t in enumerate(self.tabs):
            b = document.createElement("button")
            b.type = "button"
            b.className = "ft-tab-btn" + (" active" if idx == self.selected_index else "")
            b.textContent = str(t.text or f"Tab {idx+1}")
            def _make_clk(i):
                def _clk(e):
                    self.selected_index = i
                    if self.on_change:
                        _invoke_cb(self.on_change, ControlEvent(self, page, i))
                    page.update()
                return _clk
            p = create_proxy(_make_clk(idx))
            _active_proxies.append(p)
            b.addEventListener("click", p)
            bar.appendChild(b)
        wrap.appendChild(bar)
        if 0 <= self.selected_index < len(self.tabs):
            c = self.tabs[self.selected_index].content
            if c is not None and hasattr(c, "_render"):
                body = document.createElement("div")
                body.className = "ft-tab-body"
                body.appendChild(c._render(page))
                wrap.appendChild(body)
        self._apply_common(wrap)
        return wrap

class DataColumn:
    def __init__(self, label, numeric=False):
        self.label = label

class DataCell:
    def __init__(self, content):
        self.content = content

class DataRow:
    def __init__(self, cells=None):
        self.cells = list(cells or [])

class DataTable(Control):
    def __init__(self, columns=None, rows=None, **kwargs):
        super().__init__(**kwargs)
        self.columns = list(columns or [])
        self.rows = list(rows or [])

    def _render(self, page):
        tbl = document.createElement("table")
        tbl.className = "ft-table"
        thead = document.createElement("thead")
        tr = document.createElement("tr")
        for col in self.columns:
            th = document.createElement("th")
            if hasattr(col.label, "_render"):
                th.appendChild(col.label._render(page))
            else:
                th.textContent = str(col.label)
            tr.appendChild(th)
        thead.appendChild(tr)
        tbl.appendChild(thead)
        tbody = document.createElement("tbody")
        for row in self.rows:
            rtr = document.createElement("tr")
            for cell in row.cells:
                td = document.createElement("td")
                if hasattr(cell.content, "_render"):
                    td.appendChild(cell.content._render(page))
                else:
                    td.textContent = str(cell.content)
                rtr.appendChild(td)
            tbody.appendChild(rtr)
        tbl.appendChild(tbody)
        self._apply_common(tbl)
        return tbl

class SnackBar(Control):
    def __init__(self, content=None, open=False, **kwargs):
        super().__init__(**kwargs)
        self.content = content
        self.open = open

class AlertDialog(Control):
    def __init__(self, title=None, content=None, actions=None, open=False, **kwargs):
        super().__init__(**kwargs)
        self.title = title
        self.content = content
        self.actions = list(actions or [])
        self.open = open

class AppBar:
    def __init__(self, title=None, bgcolor=None, actions=None, **kwargs):
        self.title = title
        self.bgcolor = bgcolor
        self.actions = list(actions or [])

class _WindowStub:
    width = 800
    height = 600
    title = ""

class Page:
    def __init__(self):
        self.title = "Flet App"
        self.theme_mode = "system"
        self.bgcolor = None
        self.padding = 20
        self.horizontal_alignment = "stretch"
        self.vertical_alignment = "flex-start"
        self.scroll = None
        self.controls = []
        self.overlay = []
        self.appbar = None
        self.dialog = None
        self.snack_bar = None
        self.window = _WindowStub()

    def add(self, *controls):
        for c in controls:
            self.controls.append(c)
        self.update()

    def remove(self, *controls):
        for c in controls:
            if c in self.controls:
                self.controls.remove(c)
        self.update()

    def clean(self):
        self.controls.clear()
        self.update()

    def open(self, control):
        control.open = True
        if isinstance(control, AlertDialog):
            self.dialog = control
        elif isinstance(control, SnackBar):
            self.snack_bar = control
        self.update()

    def close(self, control):
        control.open = False
        if self.dialog is control:
            self.dialog = None
        self.update()

    def show_snack_bar(self, sb):
        sb.open = True
        self.snack_bar = sb
        self.update()

    def update(self):
        global _active_proxies
        root = document.getElementById("flet-root")
        if root is None:
            return
        active = document.activeElement
        active_fid = active.dataset.fid if (active and active.dataset and active.dataset.fid) else None
        sel_start = getattr(active, "selectionStart", None) if active_fid else None
        sel_end = getattr(active, "selectionEnd", None) if active_fid else None

        for p in _active_proxies:
            try:
                p.destroy()
            except Exception:
                pass
        _active_proxies = []

        root.innerHTML = ""
        if self.bgcolor:
            document.body.style.background = _resolve_color(self.bgcolor)
        if self.padding is not None:
            root.style.padding = f"{self.padding}px" if isinstance(self.padding, (int, float)) else str(self.padding)

        if self.appbar is not None:
            bar = document.createElement("div")
            bar.className = "ft-appbar"
            if self.appbar.bgcolor:
                bar.style.background = _resolve_color(self.appbar.bgcolor)
            if self.appbar.title is not None:
                if hasattr(self.appbar.title, "_render"):
                    bar.appendChild(self.appbar.title._render(self))
                else:
                    bar.textContent = str(self.appbar.title)
            root.appendChild(bar)

        main_col = document.createElement("div")
        main_col.className = "ft-col"
        main_col.style.gap = "12px"
        main_col.style.alignItems = str(self.horizontal_alignment or "stretch")
        for c in self.controls:
            if c is not None and hasattr(c, "_render"):
                main_col.appendChild(c._render(self))
        root.appendChild(main_col)

        if self.dialog and self.dialog.open:
            backdrop = document.createElement("div")
            backdrop.className = "ft-dialog-backdrop"
            box = document.createElement("div")
            box.className = "ft-dialog"
            if self.dialog.title and hasattr(self.dialog.title, "_render"):
                t_el = document.createElement("div")
                t_el.className = "ft-dialog-title"
                t_el.appendChild(self.dialog.title._render(self))
                box.appendChild(t_el)
            if self.dialog.content and hasattr(self.dialog.content, "_render"):
                box.appendChild(self.dialog.content._render(self))
            if self.dialog.actions:
                act_row = document.createElement("div")
                act_row.className = "ft-dialog-actions"
                for a in self.dialog.actions:
                    if hasattr(a, "_render"):
                        act_row.appendChild(a._render(self))
                box.appendChild(act_row)
            backdrop.appendChild(box)
            root.appendChild(backdrop)

        if self.snack_bar and self.snack_bar.open:
            sb = document.createElement("div")
            sb.className = "ft-snackbar"
            if self.snack_bar.content and hasattr(self.snack_bar.content, "_render"):
                sb.appendChild(self.snack_bar.content._render(self))
            root.appendChild(sb)

        if active_fid:
            target = root.querySelector(f'[data-fid="{active_fid}"]')
            if target is not None:
                target.focus()
                if sel_start is not None and hasattr(target, "setSelectionRange"):
                    try:
                        target.setSelectionRange(sel_start, sel_end)
                    except Exception:
                        pass

_current_page = Page()

def app(target=None, **kwargs):
    global _current_page
    if target is None:
        return
    _current_page = Page()
    res = target(_current_page)
    if inspect.isawaitable(res):
        asyncio.ensure_future(res)
    else:
        _current_page.update()

run = app
`;

export const NICEGUI_PYTHON_SHIM = String.raw`
import asyncio
import inspect
from js import document, window, console
from pyodide.ffi import create_proxy

_container_stack = []
_page_routes = {}
_proxies = []
_next_uid = 1

def _uid():
    global _next_uid
    v = f"ng-{_next_uid}"
    _next_uid += 1
    return v

class _Event:
    def __init__(self, sender, value=None):
        self.sender = sender
        self.value = value

def _call(cb, ev):
    if cb is None:
        return
    try:
        res = cb(ev)
        if inspect.isawaitable(res):
            asyncio.ensure_future(res)
    except Exception as ex:
        console.error(f"NiceGUI callback error: {ex}")

def _get_parent():
    if _container_stack:
        return _container_stack[-1]
    root = document.getElementById("nicegui-root")
    return root

class Element:
    def __init__(self, tag="div", class_name=""):
        self.id = _uid()
        self.el = document.createElement(tag)
        if class_name:
            self.el.className = class_name
        self.el.dataset.ngid = self.id
        parent = _get_parent()
        if parent is not None:
            parent.appendChild(self.el)

    def __enter__(self):
        _container_stack.append(self.el)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if _container_stack and _container_stack[-1] is self.el:
            _container_stack.pop()

    def classes(self, add="", remove="", replace=None):
        if replace is not None:
            self.el.className = replace
        if remove:
            for c in str(remove).split():
                self.el.classList.remove(c)
        if add:
            for c in str(add).split():
                self.el.classList.add(c)
        return self

    def style(self, add="", remove="", replace=None):
        if replace is not None:
            self.el.setAttribute("style", replace)
        elif add:
            cur = self.el.getAttribute("style") or ""
            self.el.setAttribute("style", f"{cur}; {add}".strip("; "))
        return self

    def props(self, add="", remove=""):
        return self

    def tooltip(self, text):
        self.el.title = str(text)
        return self

    def set_visibility(self, visible):
        self.el.style.display = "" if visible else "none"
        return self

    def clear(self):
        self.el.innerHTML = ""
        return self

    def update(self):
        return self

    def on(self, type_name, handler):
        def _cb(e):
            _call(handler, _Event(self))
        p = create_proxy(_cb)
        _proxies.append(p)
        self.el.addEventListener(type_name, p)
        return self

class Label(Element):
    def __init__(self, text=""):
        super().__init__("div", "ng-label")
        self._text = ""
        self.text = text

    @property
    def text(self):
        return self._text

    @text.setter
    def text(self, val):
        self._text = "" if val is None else str(val)
        self.el.textContent = self._text

    def set_text(self, val):
        self.text = val
        return self

class Markdown(Element):
    def __init__(self, content=""):
        super().__init__("pre", "ng-markdown")
        self.el.textContent = str(content or "")

    def set_content(self, content):
        self.el.textContent = str(content or "")
        return self

class Html(Element):
    def __init__(self, content=""):
        super().__init__("div", "ng-html")
        self.el.innerHTML = str(content or "")

    def set_content(self, content):
        self.el.innerHTML = str(content or "")
        return self

class Button(Element):
    def __init__(self, text="", on_click=None, color=None, icon=None):
        super().__init__("button", "ng-btn")
        self.el.type = "button"
        if icon:
            ic = document.createElement("span")
            ic.className = "material-symbols-rounded"
            ic.style.fontSize = "18px"
            ic.textContent = str(icon).lower()
            self.el.appendChild(ic)
        self._lbl = document.createElement("span")
        self._lbl.textContent = str(text or "")
        self.el.appendChild(self._lbl)
        if color:
            self.el.style.background = str(color)
        if on_click:
            def _clk(e):
                _call(on_click, _Event(self))
            p = create_proxy(_clk)
            _proxies.append(p)
            self.el.addEventListener("click", p)

    @property
    def text(self):
        return self._lbl.textContent

    @text.setter
    def text(self, v):
        self._lbl.textContent = str(v or "")

class Input(Element):
    def __init__(self, label=None, placeholder=None, value="", password=False, on_change=None, multiline=False):
        super().__init__("div", "ng-field")
        if label:
            l = document.createElement("label")
            l.className = "ng-field-label"
            l.textContent = str(label)
            self.el.appendChild(l)
        self._inp = document.createElement("textarea" if multiline else "input")
        if not multiline:
            self._inp.type = "password" if password else "text"
        self._inp.className = "ng-input"
        self._inp.value = "" if value is None else str(value)
        if placeholder:
            self._inp.placeholder = str(placeholder)
        self._value = self._inp.value
        def _chg(e):
            self._value = e.target.value
            if on_change:
                _call(on_change, _Event(self, self._value))
        p = create_proxy(_chg)
        _proxies.append(p)
        self._inp.addEventListener("input", p)
        self.el.appendChild(self._inp)

    @property
    def value(self):
        return self._value

    @value.setter
    def value(self, v):
        self._value = "" if v is None else str(v)
        self._inp.value = self._value

    def set_value(self, v):
        self.value = v
        return self

class Number(Element):
    def __init__(self, label=None, value=0, min=None, max=None, step=None, on_change=None):
        super().__init__("div", "ng-field")
        if label:
            l = document.createElement("label")
            l.className = "ng-field-label"
            l.textContent = str(label)
            self.el.appendChild(l)
        self._inp = document.createElement("input")
        self._inp.type = "number"
        self._inp.className = "ng-input"
        if min is not None: self._inp.min = str(min)
        if max is not None: self._inp.max = str(max)
        if step is not None: self._inp.step = str(step)
        self._value = 0 if value is None else float(value)
        self._inp.value = str(self._value)
        def _chg(e):
            try:
                self._value = float(e.target.value)
            except Exception:
                self._value = 0
            if on_change:
                _call(on_change, _Event(self, self._value))
        p = create_proxy(_chg)
        _proxies.append(p)
        self._inp.addEventListener("input", p)
        self.el.appendChild(self._inp)

    @property
    def value(self):
        return self._value

    @value.setter
    def value(self, v):
        self._value = float(v)
        self._inp.value = str(self._value)

class Checkbox(Element):
    def __init__(self, text="", value=False, on_change=None):
        super().__init__("label", "ng-check-row")
        self._inp = document.createElement("input")
        self._inp.type = "checkbox"
        self._inp.checked = bool(value)
        self._value = bool(value)
        def _chg(e):
            self._value = bool(e.target.checked)
            if on_change:
                _call(on_change, _Event(self, self._value))
        p = create_proxy(_chg)
        _proxies.append(p)
        self._inp.addEventListener("change", p)
        self.el.appendChild(self._inp)
        if text:
            sp = document.createElement("span")
            sp.textContent = str(text)
            self.el.appendChild(sp)

    @property
    def value(self):
        return self._value

    @value.setter
    def value(self, v):
        self._value = bool(v)
        self._inp.checked = self._value

class Switch(Checkbox):
    def __init__(self, text="", value=False, on_change=None):
        super().__init__(text=text, value=value, on_change=on_change)
        self._inp.className = "ng-switch"

class Slider(Element):
    def __init__(self, min=0, max=100, step=1, value=0, on_change=None):
        super().__init__("div", "ng-slider-wrap")
        self._inp = document.createElement("input")
        self._inp.type = "range"
        self._inp.min = str(min)
        self._inp.max = str(max)
        self._inp.step = str(step)
        self._value = value
        self._inp.value = str(value)
        self._val_lbl = document.createElement("span")
        self._val_lbl.className = "ng-slider-val"
        self._val_lbl.textContent = str(value)
        def _chg(e):
            self._value = float(e.target.value)
            self._val_lbl.textContent = str(round(self._value, 2))
            if on_change:
                _call(on_change, _Event(self, self._value))
        p = create_proxy(_chg)
        _proxies.append(p)
        self._inp.addEventListener("input", p)
        self.el.appendChild(self._inp)
        self.el.appendChild(self._val_lbl)

    @property
    def value(self):
        return self._value

    @value.setter
    def value(self, v):
        self._value = v
        self._inp.value = str(v)
        self._val_lbl.textContent = str(v)

class Select(Element):
    def __init__(self, options, label=None, value=None, on_change=None):
        super().__init__("div", "ng-field")
        if label:
            l = document.createElement("label")
            l.className = "ng-field-label"
            l.textContent = str(label)
            self.el.appendChild(l)
        self._sel = document.createElement("select")
        self._sel.className = "ng-input"
        pairs = list(options.items()) if isinstance(options, dict) else [(o, o) for o in options]
        self._value = value if value is not None else (pairs[0][0] if pairs else None)
        for k, txt in pairs:
            o = document.createElement("option")
            o.value = str(k)
            o.textContent = str(txt)
            if str(k) == str(self._value):
                o.selected = True
            self._sel.appendChild(o)
        def _chg(e):
            self._value = e.target.value
            if on_change:
                _call(on_change, _Event(self, self._value))
        p = create_proxy(_chg)
        _proxies.append(p)
        self._sel.addEventListener("change", p)
        self.el.appendChild(self._sel)

    @property
    def value(self):
        return self._value

    @value.setter
    def value(self, v):
        self._value = v
        self._sel.value = str(v)

class LinearProgress(Element):
    def __init__(self, value=0, show_value=True):
        super().__init__("div", "ng-progress-track")
        self._fill = document.createElement("div")
        self._fill.className = "ng-progress-fill"
        self.value = value
        self.el.appendChild(self._fill)

    @property
    def value(self):
        return self._value

    @value.setter
    def value(self, v):
        self._value = v
        pct = max(0, min(100, float(v or 0) * 100))
        self._fill.style.width = f"{pct}%"

class Table(Element):
    def __init__(self, columns=None, rows=None, title=None):
        super().__init__("div", "ng-table-wrap")
        if title:
            h = document.createElement("div")
            h.className = "ng-table-title"
            h.textContent = str(title)
            self.el.appendChild(h)
        tbl = document.createElement("table")
        tbl.className = "ng-table"
        cols = list(columns or [])
        thead = document.createElement("thead")
        tr = document.createElement("tr")
        for c in cols:
            th = document.createElement("th")
            th.textContent = str(c.get("label", c.get("name", "")))
            tr.appendChild(th)
        thead.appendChild(tr)
        tbl.appendChild(thead)
        tbody = document.createElement("tbody")
        for r in (rows or []):
            rtr = document.createElement("tr")
            for c in cols:
                td = document.createElement("td")
                field = c.get("field", c.get("name"))
                td.textContent = str(r.get(field, ""))
                rtr.appendChild(td)
            tbody.appendChild(rtr)
        tbl.appendChild(tbody)
        self.el.appendChild(tbl)

class _UI:
    def label(self, text=""): return Label(text)
    def markdown(self, content=""): return Markdown(content)
    def html(self, content=""): return Html(content)
    def code(self, content="", language=None): return Markdown(content)
    def button(self, text="", on_click=None, color=None, icon=None): return Button(text, on_click, color, icon)
    def input(self, label=None, placeholder=None, value="", password=False, on_change=None): return Input(label, placeholder, value, password, on_change)
    def textarea(self, label=None, placeholder=None, value="", on_change=None): return Input(label, placeholder, value, False, on_change, multiline=True)
    def number(self, label=None, value=0, min=None, max=None, step=None, on_change=None): return Number(label, value, min, max, step, on_change)
    def checkbox(self, text="", value=False, on_change=None): return Checkbox(text, value, on_change)
    def switch(self, text="", value=False, on_change=None): return Switch(text, value, on_change)
    def slider(self, min=0, max=100, step=1, value=0, on_change=None): return Slider(min, max, step, value, on_change)
    def select(self, options, label=None, value=None, on_change=None): return Select(options, label, value, on_change)
    def linear_progress(self, value=0, show_value=True): return LinearProgress(value, show_value)
    def table(self, columns=None, rows=None, title=None): return Table(columns, rows, title)
    def row(self): return Element("div", "ng-row")
    def column(self): return Element("div", "ng-col")
    def card(self): return Element("div", "ng-card")
    def grid(self, columns=2):
        el = Element("div", "ng-grid")
        el.el.style.gridTemplateColumns = f"repeat({columns}, minmax(0, 1fr))"
        return el
    def expansion(self, text="", icon=None, value=False):
        det = Element("details", "ng-expansion")
        if value: det.el.open = True
        sm = document.createElement("summary")
        sm.textContent = str(text)
        det.el.appendChild(sm)
        return det
    def separator(self): return Element("hr", "ng-separator")
    def space(self):
        el = Element("div")
        el.el.style.flex = "1"
        return el
    def badge(self, text="", color="#2563eb"):
        b = Label(text)
        b.el.className = "ng-badge"
        b.el.style.background = str(color)
        return b
    def chip(self, text="", icon=None, on_click=None):
        b = Button(text, on_click=on_click, icon=icon)
        b.el.className = "ng-chip"
        return b
    def image(self, source=""):
        img = Element("img")
        img.el.src = str(source)
        img.el.style.maxWidth = "100%"
        img.el.style.borderRadius = "8px"
        return img
    def notify(self, message, type="info", **kwargs):
        t = document.createElement("div")
        t.className = f"ng-toast ng-toast-{type}"
        t.textContent = str(message)
        document.body.appendChild(t)
        def _rm():
            t.remove()
        p = create_proxy(_rm)
        window.setTimeout(p, 2600)
    def timer(self, interval, callback, once=False):
        def _tick():
            _call(callback, None)
        p = create_proxy(_tick)
        _proxies.append(p)
        if once:
            window.setTimeout(p, int(interval * 1000))
        else:
            window.setInterval(p, int(interval * 1000))
    def dark_mode(self, value=None):
        class _DM:
            def enable(self): pass
            def disable(self): pass
            def toggle(self): pass
        return _DM()
    def page(self, path="/"):
        def _dec(fn):
            _page_routes[path] = fn
            return fn
        return _dec
    def run(self, **kwargs):
        if "/" in _page_routes:
            res = _page_routes["/"]()
            if inspect.isawaitable(res):
                asyncio.ensure_future(res)

ui = _UI()

class _AppStub:
    def on_startup(self, fn): return fn
    def on_shutdown(self, fn): return fn

app = _AppStub()
`;
