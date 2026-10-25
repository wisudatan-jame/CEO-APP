# Writes Power Apps screen YAML (the format Studio's "View code" / Ctrl+C produces).
# Every property value is a Power Fx formula; emit_props() picks a safe YAML form.

def fx(v):
    return v if isinstance(v, str) else str(v).lower() if isinstance(v, bool) else str(v)

def emit_props(props, ind):
    out = []
    for k, v in props.items():
        f = '=' + fx(v)
        safe = ('\n' not in f and ': ' not in f and ' #' not in f and not f.endswith(' ') and "'" not in f[:2])
        if safe:
            out.append(f"{ind}{k}: {f}")
        else:
            out.append(f"{ind}{k}: |-")
            for line in f.split('\n'):
                out.append(f"{ind}  {line}")
    return out

def emit_control(name, c, ind):
    out = [f"{ind}- {name}:"]
    out.append(f"{ind}    Control: {c['type']}")
    if c.get('variant'):
        out.append(f"{ind}    Variant: {c['variant']}")
    if c.get('props'):
        out.append(f"{ind}    Properties:")
        out += emit_props(c['props'], ind + '      ')
    if c.get('children'):
        out.append(f"{ind}    Children:")
        for cn, cc in c['children']:
            out += emit_control(cn, cc, ind + '      ')
    return out

def screen(name, props, children):
    out = ["Screens:", f"  {name}:"]
    if props:
        out.append("    Properties:")
        out += emit_props(props, '      ')
    out.append("    Children:")
    for cn, cc in children:
        out += emit_control(cn, cc, '      ')
    return '\n'.join(out) + '\n'

# ---------- control helpers (types match the app's own exported code) ----------
FONT = "Font.'Open Sans'"

def label(text, **p):
    props = {'Text': text, 'Font': FONT, 'Size': p.pop('Size', 14), 'Color': p.pop('Color', 'clrText')}
    props.update(p)
    return {'type': 'Label@2.5.1', 'props': props}

def button(text, onselect, **p):
    props = {'Text': text, 'OnSelect': onselect, 'Font': FONT, 'Size': 15, 'FontWeight': 'FontWeight.Semibold',
             'Fill': 'clrAccent', 'Color': 'Color.White', 'BorderColor': 'clrAccent', 'BorderThickness': 0,
             'RadiusTopLeft': 14, 'RadiusTopRight': 14, 'RadiusBottomLeft': 14, 'RadiusBottomRight': 14,
             'HoverFill': 'ColorFade(Self.Fill, -10%)', 'HoverColor': 'Self.Color', 'HoverBorderColor': 'Self.BorderColor',
             'PressedFill': 'ColorFade(Self.Fill, -20%)', 'PressedColor': 'Self.Color', 'PressedBorderColor': 'Self.BorderColor'}
    props.update(p)
    return {'type': 'Classic/Button@2.2.0', 'props': props}

def rect(**p):
    return {'type': 'Rectangle@2.3.0', 'props': p}

def image(img, **p):
    props = {'Image': img, 'ImagePosition': 'ImagePosition.Fit'}
    props.update(p)
    return {'type': 'Image@2.2.3', 'props': props}

def gallery(items, children, **p):
    props = {'Items': items}
    props.update(p)
    return {'type': 'Gallery@2.15.0', 'variant': 'BrowseLayout_Vertical_TwoTextOneImageVariant_ver5.0', 'props': props, 'children': children}

def vbox(children, **p):
    props = {'LayoutDirection': 'LayoutDirection.Vertical', 'LayoutAlignItems': 'LayoutAlignItems.Stretch',
             'LayoutGap': 10, 'DropShadow': 'DropShadow.None', 'Fill': 'Color.Transparent', 'BorderThickness': 0}
    props.update(p)
    return {'type': 'GroupContainer@1.3.0', 'variant': 'AutoLayout', 'props': props, 'children': children}

def hbox(children, **p):
    props = {'LayoutDirection': 'LayoutDirection.Horizontal', 'LayoutAlignItems': 'LayoutAlignItems.Stretch',
             'LayoutGap': 12, 'DropShadow': 'DropShadow.None', 'Fill': 'Color.Transparent', 'BorderThickness': 0}
    props.update(p)
    return {'type': 'GroupContainer@1.3.0', 'variant': 'AutoLayout', 'props': props, 'children': children}

def card(children, height, **p):
    return vbox(children, Fill='Color.White', BorderColor='clrLine', BorderThickness=2,
                RadiusTopLeft=20, RadiusTopRight=20, RadiusBottomLeft=20, RadiusBottomRight=20,
                PaddingTop=14, PaddingBottom=14, PaddingLeft=18, PaddingRight=18,
                FillPortions=0, AlignInContainer='AlignInContainer.Stretch', Height=height, **p)

def in_box(c, fill=0, **p):
    """Placement inside an auto-layout box: fixed size unless fill > 0."""
    c['props'].update({'FillPortions': fill, 'AlignInContainer': 'AlignInContainer.Stretch'}, **p)
    return c

def header(sfx):
    return [
        (f'recTop{sfx}', rect(Fill='clrPrimary', Height=90, Width='Parent.Width')),
        (f'recTopLine{sfx}', rect(Fill='clrAccent', Height=4, Width='Parent.Width', Y=90)),
        (f'imgLogo{sfx}', image("'df-logo-white'", X=16, Y=12, Width=150, Height=66)),
        (f'imgCEO{sfx}', image("'ceo-avatar-sangngan'", X='Parent.Width - 80', Y=4, Width=64, Height=83)),
    ]

TAB_H = 96

def tabs(sfx, items, active):
    n = len(items)
    out = [(f'recTabLine{sfx}', rect(Fill='clrLine', X=0, Y=f'Parent.Height - {TAB_H}', Width='Parent.Width', Height=2))]
    for i, (key, text, onselect) in enumerate(items):
        on = key == active
        out.append((f'btnTab{key}{sfx}', button(text, onselect,
            X=f'Parent.Width * {i} / {n}' if i else 0, Y=f'Parent.Height - {TAB_H} + 2', Width=f'Parent.Width / {n}', Height=TAB_H - 2,
            Fill='Color.White', Color='clrAccent' if on else 'clrMuted', BorderThickness=0,
            FontWeight='FontWeight.Bold' if on else 'FontWeight.Normal', Size=14,
            RadiusTopLeft=0, RadiusTopRight=0, RadiusBottomLeft=0, RadiusBottomRight=0,
            HoverFill='clrBg', PressedFill='clrLine')))
    return out
