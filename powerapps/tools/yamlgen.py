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
             'PaddingTop': 0, 'PaddingBottom': 0, 'PaddingLeft': 0, 'PaddingRight': 0,
             'LayoutGap': 10, 'DropShadow': 'DropShadow.None', 'Fill': 'Color.Transparent', 'BorderThickness': 0}
    props.update(p)
    return {'type': 'GroupContainer@1.3.0', 'variant': 'AutoLayout', 'props': props, 'children': children}

def hbox(children, **p):
    props = {'LayoutDirection': 'LayoutDirection.Horizontal', 'LayoutAlignItems': 'LayoutAlignItems.Stretch',
             'PaddingTop': 0, 'PaddingBottom': 0, 'PaddingLeft': 0, 'PaddingRight': 0,
             'LayoutGap': 12, 'DropShadow': 'DropShadow.None', 'Fill': 'Color.Transparent', 'BorderThickness': 0}
    props.update(p)
    # A stretched item in a row came out taller than the row on paste (text pushed down and cut off),
    # so row items sit at the top with their own height; items without one take the row's inner height.
    inner = f"Parent.Height - {props['PaddingTop']} - {props['PaddingBottom']}"
    for _, c in children:
        cp = c['props']
        if cp.get('AlignInContainer', 'AlignInContainer.Stretch') == 'AlignInContainer.Stretch':
            cp['AlignInContainer'] = 'AlignInContainer.Start'
            cp.setdefault('Height', inner)
        cp['LayoutMinHeight'] = 0  # the default minimum is taller than our rows and pushed text and button borders out of the row
    return {'type': 'GroupContainer@1.3.0', 'variant': 'AutoLayout', 'props': props, 'children': children}

def card(children, height, **p):
    return vbox(children, Fill='Color.White', BorderColor='clrLine', BorderThickness=2,
                RadiusTopLeft=20, RadiusTopRight=20, RadiusBottomLeft=20, RadiusBottomRight=20,
                PaddingTop=14, PaddingBottom=14, PaddingLeft=18, PaddingRight=18,
                FillPortions=0, AlignInContainer='AlignInContainer.Stretch', Height=f'{height} + 4', **p)  # + top/bottom border

def panel(children, x, y, w, h, **p):
    """White rounded box placed on the screen; lists sit inside one so their position never depends on the gallery's own X."""
    props = dict(Fill='Color.White', BorderColor='clrLine', BorderThickness=2, LayoutGap=6,
                 RadiusTopLeft=20, RadiusTopRight=20, RadiusBottomLeft=20, RadiusBottomRight=20,
                 PaddingTop=12, PaddingBottom=8, PaddingLeft=18, PaddingRight=18, X=x, Y=y, Width=w, Height=h)
    props.update(p)
    return vbox(children, **props)

def list_in(gal):
    """A gallery that fills the rest of a panel."""
    gal['props'].update(Fill='Color.Transparent', BorderThickness=0)
    return in_box(gal, 1, LayoutMinHeight=0)

def kpi_card(key, title, num, sub, onselect, x, y, w, hot=False, title_c='clrPrimary', num_c='clrPrimary'):
    """Overview card: small title, big number, one-line note (button underneath takes the tap, labels pass it on)."""
    fg = lambda c: 'Color.White' if hot else c
    lab = dict(X=f'{x} + 20', Width=f'{w} - 40', OnSelect=onselect)
    return [
        (f'btn{key}', button('""', onselect, X=x, Y=y, Width=w, Height=140, Fill='clrAccent' if hot else 'Color.White',
                             BorderColor='clrAccent' if hot else 'clrLine', BorderThickness=2,
                             RadiusTopLeft=20, RadiusTopRight=20, RadiusBottomLeft=20, RadiusBottomRight=20)),
        (f'lbl{key}T', label(title, Y=y + 14, Height=30, Size=14, FontWeight='FontWeight.Semibold', Color=fg(title_c), **lab)),
        (f'lbl{key}N', label(num, Y=y + 42, Height=58, Size=32, FontWeight='FontWeight.Bold', Color=fg(num_c), **lab)),
        (f'lbl{key}S', label(sub, Y=y + 100, Height=28, Size=12, Color=fg('clrMuted'), **lab)),
    ]

def back_button(target):
    return in_box(button('"‹"', f'Navigate({target})', Width=56, Height=56, Size=26, FontWeight='FontWeight.Bold',
                         Fill='Color.White', Color='clrPrimary', BorderColor='clrPrimary', BorderThickness=2,
                         PaddingTop=0, PaddingBottom=6, PaddingLeft=0, PaddingRight=0,
                         RadiusTopLeft=28, RadiusTopRight=28, RadiusBottomLeft=28, RadiusBottomRight=28),
                  0, LayoutMinWidth=56, AlignInContainer='AlignInContainer.Center')

def in_box(c, fill=0, **p):
    """Placement inside an auto-layout box: fixed size unless fill > 0."""
    c['props'].update({'FillPortions': fill, 'AlignInContainer': 'AlignInContainer.Stretch'}, **p)
    if fill and 'LayoutMinWidth' not in p:
        c['props']['LayoutMinWidth'] = 0  # share the row equally instead of keeping the default minimum width
    return c

def header(sfx):
    return [
        (f'recTop{sfx}', rect(Fill='clrPrimary', Height=90, Width='Parent.Width')),
        (f'recTopLine{sfx}', rect(Fill='clrAccent', Height=4, Width='Parent.Width', Y=90)),
        (f'imgLogo{sfx}', image("'df-logo-white'", X=16, Y=12, Width=150, Height=66)),
        (f'imgCEO{sfx}', image("'ceo-avatar-sangngan'", X='Parent.Width - 80', Y=4, Width=64, Height=83)),
    ]

TAB_H = 96
TAB_ICONS = {'Home': 'Icon.Home', 'List': 'Icon.DetailList', 'New': 'Icon.Add'}

def tabs(sfx, items, active):
    """Bottom tab bar: icon over label, the active tab in red (as in the mockup)."""
    n = len(items)
    out = [(f'recTabLine{sfx}', rect(Fill='clrLine', X=0, Y=f'Parent.Height - {TAB_H}', Width='Parent.Width', Height=2))]
    for i, (key, text, onselect) in enumerate(items):
        on = key == active
        x = f'Parent.Width * {i} / {n}' if i else 0
        color = 'clrAccent' if on else 'clrMuted'
        out.append((f'btnTab{key}{sfx}', button(text, onselect,
            X=x, Y=f'Parent.Height - {TAB_H} + 2', Width=f'Parent.Width / {n}', Height=TAB_H - 2,
            Fill='Color.White', Color=color, BorderThickness=0, VerticalAlign='VerticalAlign.Bottom', PaddingBottom=12,
            FontWeight='FontWeight.Bold' if on else 'FontWeight.Normal', Size=13,
            RadiusTopLeft=0, RadiusTopRight=0, RadiusBottomLeft=0, RadiusBottomRight=0,
            HoverFill='clrBg', PressedFill='clrLine')))
        out.append((f'icoTab{key}{sfx}', {'type': 'Classic/Icon@2.5.0', 'props': {
            'Icon': TAB_ICONS[key], 'Color': color, 'OnSelect': onselect,
            'X': f'{x} + (Parent.Width / {n} - 34) / 2' if i else f'(Parent.Width / {n} - 34) / 2',
            'Y': f'Parent.Height - {TAB_H} + 14', 'Width': 34, 'Height': 34}}))
    return out

def area(children, x, y, w, h, **p):
    """Invisible box placed on the screen (keeps a gallery where it belongs: a gallery's own X is lost on paste)."""
    return vbox(children, LayoutGap=0, X=x, Y=y, Width=w, Height=h, **p)

def row_bg(name, gap=12):
    """White rounded card behind one gallery row; the gap below it separates the cards."""
    return (name, button('""', 'Select(Parent)', X=0, Y=0, Width='Parent.TemplateWidth', Height=f'Parent.TemplateHeight - {gap}',
                         Fill='Color.White', BorderColor='clrLine', BorderThickness=2, HoverFill='clrBg', PressedFill='clrLine',
                         RadiusTopLeft=18, RadiusTopRight=18, RadiusBottomLeft=18, RadiusBottomRight=18))

def pill_colors(status, late):
    """Background and text colour of a status pill: late red, waiting blue, done green, new and in-progress grey."""
    cases = [(late, '"#FDE8E8"', 'clrDanger'), (f'{status} = "WaitingCEO"', '"#E9E9F5"', 'clrPrimary'),
             (f'{status} = "Done"', '"#E3F4EA"', '"#17703A"'), (f'{status} = "New"', '"#EEF0F4"', '"#3F4A5C"')]
    pick = lambda i, d: 'Switch(true, ' + ', '.join(f'{c}, {v[i] if v[i].startswith("clr") else f"ColorValue({v[i]})"}' for c, *v in cases) + f', {d})'
    return pick(0, 'ColorValue("#F1F2F6")'), pick(1, 'ColorValue("#3F4A5C")')

def pill(text, status, late, **p):
    bg, fg = pill_colors(status, late)
    props = dict(Fill=bg, Color=fg, BorderThickness=0, Size=12, FontWeight='FontWeight.Bold', HoverFill='Self.Fill', PressedFill='Self.Fill',
                 RadiusTopLeft=20, RadiusTopRight=20, RadiusBottomLeft=20, RadiusBottomRight=20, PaddingLeft=8, PaddingRight=8)
    props.update(p)
    return button(text, p.pop('OnSelect', 'Select(Parent)'), **props)

def link(text, onselect, width=190, **p):
    """Small text button for the right side of a card header (the mockup's "เปิดโฟลเดอร์")."""
    return in_box(button(text, onselect, Width=width, Height=34, Size=13, Fill='Color.Transparent', Color='clrPrimary', BorderThickness=0,
                         VerticalAlign='VerticalAlign.Top', PaddingTop=4,
                         Align='Align.Right', PaddingRight=0, HoverFill='Color.Transparent', PressedFill='Color.Transparent',
                         HoverColor='clrAccent', DisabledFill='Color.Transparent', DisabledColor='ColorFade(clrPrimary, 60%)', **p),
                  0, LayoutMinWidth=width)

def kv(name, key, value, fill=None, key_color='clrMuted', visible=None):
    """Two-column info row (key on the left, wrapping value on the right); its height follows the value."""
    val = f'lbl{name}'
    extra = {'Visible': visible} if visible else {}
    box = dict(Fill=fill, BorderColor='ColorFade(clrAccent, 50%)', BorderThickness=2, RadiusTopLeft=10, RadiusTopRight=10,
               RadiusBottomLeft=10, RadiusBottomRight=10, PaddingTop=8, PaddingBottom=8, PaddingLeft=10, PaddingRight=10) if fill else {}
    pad = 16 if fill else 0
    return (f'con{name}', in_box(hbox([
        (f'lbl{name}K', in_box(label(key, Width=140, Size=13, Color=key_color, FontWeight='FontWeight.Semibold' if fill else 'FontWeight.Normal',
                                     VerticalAlign='VerticalAlign.Top'), 0, LayoutMinWidth=140)),
        (val, in_box(label(value, AutoHeight='true', Size=13, VerticalAlign='VerticalAlign.Top'), 1, AlignInContainer='AlignInContainer.Start')),
    ], Height=f'{val}.Height + {pad}', LayoutGap=8, LayoutAlignItems='LayoutAlignItems.Start', **box, **extra)))

def card_head(name, text, right=None):
    """Card heading row: bold title on the left, optional link on the right (text anchored to the top of the row)."""
    kids = [(f'lbl{name}Head', in_box(label(text, Height=34, Size=15, FontWeight='FontWeight.Bold', VerticalAlign='VerticalAlign.Top', PaddingTop=2), 1))]
    if right:
        kids.append(right)
    return (f'con{name}Head', in_box(hbox(kids, Height=34)))

FILE_ROW = 46

def file_list(name, rows, name_expr):
    """One row per file: document icon, file name, date on the right (as in the mockup)."""
    return (name, in_box(gallery(rows, [
        (f'ico{name}', {'type': 'Classic/Icon@2.5.0', 'props': {'Icon': 'Icon.Document', 'Color': 'clrPrimary', 'OnSelect': 'Select(Parent)',
                                                             'X': 0, 'Y': (FILE_ROW - 24) / 2, 'Width': 24, 'Height': 24}}),
        (f'lbl{name}Name', label(name_expr, X=34, Y=0, Width='Parent.TemplateWidth - 34 - 150', Height=FILE_ROW, Size=13, Color='clrPrimary',
                                 Wrap='false', OnSelect='Select(Parent)')),
        (f'lbl{name}When', label('Text(ThisItem.Created, "d mmm hh:mm", "th-TH")', X='Parent.TemplateWidth - 146', Y=0, Width=146, Height=FILE_ROW,
                                 Size=12, Color='clrMuted', Align='Align.Right', OnSelect='Select(Parent)')),
    ], TemplateSize=FILE_ROW, Fill='Color.Transparent', ShowScrollbar='false', Height=f'CountRows(Self.AllItems) * {FILE_ROW}',
       Visible='!IsEmpty(Self.AllItems)')))
