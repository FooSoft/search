'use strict';

goog.require('goog.math');
goog.require('goog.math.Coordinate');
goog.require('goog.math.Range');
goog.require('goog.math.Rect');


//
//  Column
//

function Column(canvas, name, params, scale, range, bounds) {
    this.clearShapes = function() {
        _.each(this.shapes, function(shape) {
            this.canvas.remove(shape);
        });

        this.shapes = [];
    }

    this.updateShapes = function(final) {
        this.columnBounds = this.getColumnBounds(this.bounds);
        this.labelBounds  = this.getLabelBounds(this.columnBounds);
        this.hintBounds   = this.getHintBounds(this.columnBounds);
        this.fillBounds   = this.getFillBounds(this.columnBounds);
        this.handleBounds = this.getHandleBounds(this.columnBounds, this.fillBounds);

        if (final) {
            this.updateRect('boundsRect', {
                left:   this.columnBounds.left,
                top:    this.columnBounds.top,
                width:  this.columnBounds.width,
                height: this.columnBounds.height,
                stroke: this.strokeColor,
                fill:   this.emptyColor
            });

            this.updateRect('hintRect', {
                left:   this.hintBounds.left,
                top:    this.hintBounds.top,
                width:  this.hintBounds.width,
                height: this.hintBounds.height,
                stroke: this.strokeColor
            });

            this.hintRect.setGradient('fill', {
                x1:         0.0,
                y1:         0.0,
                x2:         0.0,
                y2:         this.hintRect.height,
                colorStops: this.decimateHints(this.steps, this.scale)
            });

            this.updateRect('labelRect', {
                left:   this.labelBounds.left,
                top:    this.labelBounds.top,
                width:  this.labelBounds.width,
                height: this.labelBounds.height,
                fill:   this.strokeColor
            });

            this.updateText('label', this.name, {
                left:     this.fillBounds.left + this.fillBounds.width / 2,
                top:      this.labelBounds.top + this.labelBounds.height / 2,
                fontSize: this.labelFontSize,
                originX:  'center',
                originY:  'center',
            });
        }

        this.updateRect('fillRect', {
            left:   this.fillBounds.left,
            top:    this.fillBounds.top,
            width:  this.fillBounds.width,
            height: this.fillBounds.height,
            fill:   this.getFillColor()
        });

        this.updateRect('handleRect', {
            left:   this.handleBounds.left,
            top:    this.handleBounds.top,
            width:  this.handleBounds.width,
            height: this.handleBounds.height,
            fill:   this.getHandleColor()
        });

        if (final && goog.math.Range.containsPoint(this.range, 0.0)) {
            var y = this.getPosFromValue(0.0);
            var p = [this.bounds.left, y, this.bounds.left + this.tickLength, y];
            this.updateLine('baseline', p, {
                stroke: this.tickColor
            });
        }

        this.canvas.renderAll();
    }

    this.updateRect = function(name, args) {
        if (name in this) {
            this[name].set(args);
        }
        else {
            var rect = new fabric.Rect(args);
            this.canvas.add(rect);
            this.shapes.push(rect);
            this[name] = rect;
        }
    }

    this.updateText = function(name, text, args) {
        if (name in this) {
            this[name].set(args);
        }
        else {
            var text = new fabric.Text(text, args);
            this.canvas.add(text);
            this.shapes.push(text);
            this[name] = text;
        }
    }

    this.updateLine = function(name, points, args) {
        if (name in this) {
            this[name].set(args);
        }
        else {
            var line = new fabric.Line(points, args);
            this.canvas.add(line);
            this.shapes.push(line);
            this[name] = line;
        }
    }

    this.decimateHints = function(steps, scale) {
        var groups = this.groupHints(steps);

        var colorStops = {};
        _.each(groups, function(count, index) {
            var colorPercent = 0;
            if (scale.getLength() > 0) {
                colorPercent = Math.max(0, count - scale.start) / scale.getLength();
            }

            var colorByte = 0xff - Math.min(0xff, Math.round(0xff * colorPercent));
            var colorObj  = tinycolor({ r: colorByte, g: colorByte, b: colorByte });
            var colorStr  = colorObj.toHexString();

            colorStops[index / steps] = colorStr;
        });

        return colorStops;
    }

    this.groupHints = function(steps) {
        var stepSize = this.range.getLength() / steps;

        var hintGroups = [];
        for (var i = 0; i < steps; ++i) {
            var stepMax = this.range.end - stepSize * i;
            var stepMin = stepMax - stepSize;

            var hintCount = 0;
            _.each(this.hints, function(hint) {
                if (hint.sample > stepMin && hint.sample <= stepMax) {
                    hintCount += hint.count;
                }
            });

            hintGroups.push(hintCount);
        }

        return hintGroups;
    }

    this.setClampedValue = function(value, final) {
        this.value = goog.math.clamp(value, this.range.start, this.range.end);
        this.updateShapes(final);

        if (this.onValueChanged && final) {
            this.onValueChanged(this.name, this.value);
        }
    }

    this.setHints = function(hints, scale) {
        this.hints = hints;
        this.scale = scale;
        this.updateShapes(true);
    }

    this.getLabelBounds = function(bounds) {
        return new goog.math.Rect(
            bounds.left,
            bounds.top + bounds.height,
            bounds.width,
            this.labelSize
        );
    }

    this.getColumnBounds = function(bounds) {
        return new goog.math.Rect(
            bounds.left + this.tickLength,
            bounds.top,
            bounds.width - this.tickLength,
            bounds.height - this.labelSize
        );
    }

    this.getHintBounds = function(bounds) {
        return new goog.math.Rect(
            bounds.left + bounds.width - this.hintSize,
            bounds.top,
            this.hintSize,
            bounds.height
        );
    }

    this.getFillBounds = function(bounds) {
        var y1 = this.getPosFromValue(0.0);
        var y2 = this.getPosFromValue(this.value);
        return new goog.math.Rect(
            bounds.left,
            Math.min(y1, y2),
            bounds.width - this.hintSize,
            Math.abs(y1 - y2)
        );
    }

    this.getHandleBounds = function(bounds, fillBounds) {
        var handleBounds = new goog.math.Rect(
            fillBounds.left,
            this.getPosFromValue(this.value) - this.handleSize / 2,
            fillBounds.width,
            this.handleSize
        );
        handleBounds.intersection(bounds);
        return handleBounds;
    }

    this.valueColorAdjust = function(color, offset) {
        var colorObj = tinycolor(color);
        var rangeEnd = this.value >= 0.0 ? this.range.end : this.range.start;
        var rangeMid = (this.range.start + this.range.end) / 2.0;
        var rangeRat = (this.value - rangeMid) / (rangeEnd - rangeMid);
        var desatVal = Math.max(0.0, 1.0 - rangeRat + offset) * 100.0;
        return colorObj.desaturate(desatVal).toHexString();
    }

    this.getFillColor = function() {
        var color = this.value >= 0.0 ? this.fillColorPos : this.fillColorNeg;
        return this.valueColorAdjust(color, this.desatOffset);
    }

    this.getHandleColor = function() {
        var color = this.value >= 0.0 ? this.handleColorPos : this.handleColorNeg;
        return this.valueColorAdjust(color, this.desatOffset);
    }

    this.mouseDown = function(position) {
        if (this.isGrabbing(position)) {
            this.stateTransition(this.State.DRAG, position);
        }
    }

    this.mouseUp = function(position) {
        this.stateTransition(
            this.isHovering(position) ? this.State.HOVER : this.State.NORMAL,
            position
        );
    }

    this.mouseMove = function(position) {
        switch (this.state) {
            case this.State.NORMAL:
                if (this.isHovering(position)) {
                    this.stateTransition(this.State.HOVER, position);
                }
                break;
            case this.State.HOVER:
                if (!this.isHovering(position)) {
                    this.stateTransition(this.State.NORMAL, position);
                }
                break;
        }

        this.stateUpdate(position);
    }

    this.mouseOut = function(position) {
        this.mouseUp(position);
    }

    this.mouseDoubleClick = function(position) {
        if (this.isContained(position)) {
            this.setClampedValue(this.getValueFromPos(position.y), true);
        }
    }

    this.getValueFromPos = function(position) {
        var percent = 1.0 - (position - this.columnBounds.top) / this.columnBounds.height;
        return this.range.start + this.range.getLength() * percent;
    }

    this.getPosFromValue = function(value) {
        var percent = 1.0 - (value - this.range.start) / this.range.getLength();
        return goog.math.clamp(
            this.columnBounds.top + this.columnBounds.height * percent,
            this.columnBounds.top,
            this.columnBounds.top + this.columnBounds.height
        );
    }

    this.isHovering = function(position) {
        return this.isGrabbing(position);
    }

    this.isGrabbing = function(position) {
        return this.handleBounds.contains(position);
    }

    this.isContained = function(position) {
        return this.columnBounds.contains(position);
    }

    this.stateUpdate = function(position) {
        switch (this.state) {
            case this.State.DRAG:
                this.setClampedValue(this.getValueFromPos(position.y) + this.dragDelta, false);
                break;
        }
    }

    this.stateTransition = function(state, position) {
        if (state == this.state) {
            return;
        }

        switch (this.state) {
            case this.State.DRAG:
                this.setClampedValue(this.getValueFromPos(position.y) + this.dragDelta, true);
            case this.State.HOVER:
                if (state == this.State.NORMAL) {
                    this.canvas.contextContainer.canvas.style.cursor = 'default';
                }
                break;
        }

        switch (state) {
            case this.State.DRAG:
                this.dragDelta = this.value - this.getValueFromPos(position.y);
            case this.State.HOVER:
                this.canvas.contextContainer.canvas.style.cursor = 'ns-resize';
                break;
        }

        this.state = state;
    }

    this.State = {
        NORMAL: 0,
        HOVER:  1,
        DRAG:   2
    };

    this.handleSize     = 10;
    this.desatOffset    = -0.3;
    this.hintSize       = 10;
    this.labelFontSize  = 15;
    this.labelSize      = 20;
    this.tickLength     = 5;
    this.emptyColor     = '#eeeeec';
    this.strokeColor    = '#d3d7cf';
    this.tickColor      = '#888a85';
    this.fillColorNeg   = '#3465a4';
    this.fillColorPos   = '#cc0000';
    this.handleColorNeg = '#204a87';
    this.handleColorPos = '#a40000';

    this.canvas = canvas;
    this.shapes = [];
    this.name   = name;
    this.value  = params.value;
    this.hints  = params.hints;
    this.steps  = params.steps;
    this.scale  = scale;
    this.range  = range;
    this.bounds = bounds;
    this.state  = this.State.NORMAL;

    this.updateShapes(true);
}


//
//  Grapher
//

function Grapher(canvas, range, columnWidth, useLocalScale, useRelativeScale) {
    this.setColumns = function(columns) {
        this.clearColumns();

        var scale = 0;
        if (!useLocalScale) {
            var hintData = {};
            _.each(columns, function(columnValue, columnName) {
                hintData[columnName] = columnValue.hints || [];
            });

            scale = this.getGlobalScale(hintData);
        }

        var graphBounds = this.getGraphBounds(this.getCanvasBounds());

        var index = 0;
        var that  = this;
        _.each(columns, function(columnValue, columnName) {
            if (useLocalScale) {
                scale = that.getLocalScale(columnValue.hints);
            }

            var columnBounds = that.getColumnBounds(graphBounds, index);
            that.columns.push(new Column(that.canvas, columnName, columnValue, scale, that.range, columnBounds));
            that.indexMap[columnName] = index++;
        });
    }

    this.clearColumns = function() {
        _.each(this.columns, function(column) {
            column.clearShapes();
        });

        this.columns  = [];
        this.indexMap = {};
    }

    this.setColumnHints = function(hintData) {
        var scale = 0;
        if (!this.useLocalScale) {
            scale = this.getGlobalScale(hintData);
        }

        var that    = this;
        _.each(hintData, function(hints, name) {
            var index = that.getColumnIndex(name);
            console.assert(index >= 0);

            if (that.useLocalScale) {
                scale = that.getLocalScale(hints);
            }

            that.columns[index].setHints(hints, scale);
        });
    }

    this.setUseLocalScale = function(useLocalScale) {
        if (useLocalScale != this.useLocalScale) {
            this.useLocalScale = useLocalScale;
            this.invalidateHints();
        }
    }

    this.setUseRelativeScale = function(useRelativeScale) {
        if (useRelativeScale != this.useRelativeScale) {
            this.useRelativeScale = useRelativeScale;
            this.invalidateHints();
        }
    }

    this.invalidateHints = function() {
        var hintData = {};
        _.each(this.columns, function(column) {
            hintData[column.name] = column.hints;
        });

        this.setColumnHints(hintData);
    }

    this.setValueChangedListener = function(listener) {
        _.each(this.columns, function(column) {
            column.onValueChanged = listener;
        });
    }

    this.getLocalScale = function(hints) {
        var counts = _.pluck(hints, 'count');
        var min = this.useRelativeScale ? _.min(counts) : 0;
        return new goog.math.Range(min, _.max(counts));
    }

    this.getGlobalScale = function(hintData) {
        var that        = this;
        var globalScale = null;

        _.each(hintData, function(hints) {
            var localScale = that.getLocalScale(hints);
            if (globalScale) {
                globalScale.includeRange(localScale);
            }
            else {
                globalScale = localScale;
            }
        });

        return globalScale;
    }

    this.getColumnCount = function() {
        return this.columns.length;
    }

    this.getColumnIndex = function(name) {
        console.assert(name in this.indexMap);
        return this.indexMap[name];
    }

    this.getColumnName = function(index) {
        return this.columns[index].name;
    }

    this.getColumnNames = function() {
        return _.pluck(this.columns, 'name');
    }

    this.getCanvasBounds = function() {
        return new goog.math.Rect(0, 0, this.canvas.width - 1, this.canvas.height - 1);
    }

    this.getGraphBounds = function(bounds) {
        return this.getCanvasBounds();
    }

    this.getColumnBounds = function(bounds, index, count) {
        var width = this.columnWidth + this.padding * 2;
        return new goog.math.Rect(
            bounds.left + width * index + this.padding,
            bounds.top,
            this.columnWidth,
            bounds.height
        );
    }

    this.getMousePos = function(e) {
        var rect = e.target.getBoundingClientRect();
        return new goog.math.Coordinate(
            e.clientX - rect.left,
            e.clientY - rect.top
        );
    }

    this.mouseDown = function(e) {
        var position = this.grapher.getMousePos(e);
        _.each(this.grapher.columns, function(column) {
            column.mouseDown(position);
        });
    }

    this.mouseUp = function(e) {
        var position = this.grapher.getMousePos(e);
        _.each(this.grapher.columns, function(column) {
            column.mouseUp(position);
        });
    }

    this.mouseMove = function(e) {
        var position = this.grapher.getMousePos(e);
        _.each(this.grapher.columns, function(column) {
            column.mouseMove(position);
        });
    }

    this.mouseOut = function(e) {
        var position = this.grapher.getMousePos(e);
        _.each(this.grapher.columns, function(column) {
            column.mouseOut(position);
        });
    }

    this.mouseDoubleClick = function(e) {
        var position = this.grapher.getMousePos(e);
        _.each(this.grapher.columns, function(column) {
            column.mouseDoubleClick(position);
        });
    }

    this.useLocalScale    = useLocalScale;
    this.useRelativeScale = useRelativeScale;
    this.columnWidth      = columnWidth;
    this.canvas           = new fabric.StaticCanvas(canvas);
    this.range            = new goog.math.Range(range.min, range.max);
    this.padding          = 10;
    this.indexMap         = {};
    this.columns          = [];

    var c = this.canvas.contextContainer.canvas;
    c.addEventListener('mousedown', this.mouseDown, false);
    c.addEventListener('mouseup', this.mouseUp, false);
    c.addEventListener('mousemove', this.mouseMove, false);
    c.addEventListener('mouseout', this.mouseOut, false);
    c.addEventListener('dblclick', this.mouseDoubleClick, false);
    c.grapher = this;
}