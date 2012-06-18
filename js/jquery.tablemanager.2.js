/*
 * jQuery tablemanager plugin
 *
 * Version: 0.3
 * Authors: Mathias Vonende, Gerrit Imsieke, le-tex publishing services GmbH
 * Date :   2012-05-07
 * 
 * A plugin to toggle the visibility of rows and columns in an 
 * HTML Table. 
 * 
 * Requires clickMenu for the column selector widget:
 * http://p.sohei.org/jquery-plugins/clickmenu/
 *
 * Usage:
 * Attach a class 'tablemanager' to each table that should be managed.
 * The table must have an id attribute.
 * Attach a class 'tablemanager-collapsible' to each th that should be collapsible.
 * Put the column heads as th elements in a thead element (instead of putting them in tbody).
 *
 * $('table.tablemanager').each(function() {
 *   $.fn.tablemanager($(this), {mincols: 5});
 * });
 *
 * mincols is the minimum number of columns that the table must have 
 * for a column selector widget to be rendered.
 *
 */


(function($){
  var cssclasses = {
  collapsible    : "tablemanager-collapsible",
  noncollapsible : "tablemanager-non-collapsible",
  row_collapse   : "tablemanager-row",
  img_widget     : "tablemanager-selector-widget",
  col_collapse   : "",
  col_extended   : "",
  row_collapse   : "",
  row_extended   : "",
  };
    
  $.fn.tablemanager = function(method, args){
    method_dispatcher(method, args);
  };  
    
  function method_dispatcher(method, args){
    if (methods[method]) {
      return methods[method].apply(this, args);
    }
    else if(typeof method === 'object' || ! method ){
      return methods.init.call(this, method, args);
    }
    else {
      $.error( 'Method: ' +  method + ' does not exist on jQuery.tablemanager');
    }
  };
    
  var methods = {
    init : function(t, args){
      /*
       * $.fn.tablemanager()
       * 
       * the init method. 
       *
       * Normalize the table (= dissolve colspans and rowspans). The normalized 
       * version will be stored in table.data('colrefs'). This is an array
       * that stores, for each elementary cell of the normalized table, a
       * reference to the cell element (jQuery object representing th or td)
       * that covers this elementary cell. We speak of the "physical grid".
       * Example. Consider this 4x3 table:
       * +--++
       * +++++
       * | |++
       * +++++
       * The cell starting in (0,0) has a colspan of 3.
       * The cell starting in (0,1) has a colspan of 2 and a rowspan of 2.
       * table.data('colrefs') will be an array of length 12 that will 
       * store the physical grid coverage row-wise. So the array positions
       * 0, 1, and 2 will hold a reference to the (0,0) cell with colspan 3,
       * position 3 will refer to the second HTML cell in the first tr,
       * positions 4, 5, 8, and 9 will refer to the first HTML cell in the 
       * second tr, etc. 
       * The table width will be known after the first tr and its colspans
       * have been processed. (We are not considering pathological tables
       * whose physical width varies from row to row.)
       * There is an accessor function to get the cellref for each physical
       * position (x,y): arrpos(x,y,w) will simply calculate the array index.
       * So in order to ask: which HTML cell covers the last physical cell
       * (3,2) of the table above, you use 
       * table.data('colrefs')[arrpos(3,2,table.data('width'))]
       * 
       * A second, sparse array of all cell origins is available:
       * table.data('origins')[arrpos(0,1,table.data('width'))] => 1st cell in 2nd tr
       * table.data('origins')[arrpos(1,1,table.data('width'))] => undefined (colspanned area)
       * This is because when iterating over the physical grid, in order to
       * retrieve all cells that cover a rectangle, multiple instances of
       * a single cell would be returned. jQuery.unique() doesn't seem to 
       * reduce the rectangle to a set of unique cells, so we store 
       * table.data('origins') in addition to table.data('cellrefs').
       *
       * What else is happening during initialization?
       *
       * Render a collapse/expand icon ([+]/[-]) in each thead th 
       * with the css class 'tablemanager-collapsible'.
       * onclick event for this icon: $.fn.tablemanager('toggle_col');
       * 
       * Render a collapse/expand icon in each tbody th 
       * with the css class 'tablemanager-collapsible'.
       * onclick event for this icon: $.fn.tablemanager('toggle_row');
       *
       * Use clickMenu to create a separate widget for toggling the columns.
       * An optional integer argument, mincols, specifies the minimum number of 
       * columns for the column toggler widget to be created.
       */
      table = $(t);
      
      init_cellspace(table);
      if (args.mincols == undefined || args.mincols <= table.data('width')) {
        render_head_list(table);

        var tlist = $('#' + table.attr('id') + '_colsList');
        tlist.clickMenu();
	
        close_li = $('<li class="main close"><img src="img/close.png" alt="close menu" title="close click menu"/></li>');
        close_li.click(function(){
            tabid = $(this).parents("table").attr("id");
            $('#' + table.attr('id') + '_colsList').trigger("closemenu");
        });
        close_li.css("visibility", "hidden");
        tlist.append(close_li);
       //fix_row_headers(table);
      }
      tlist.bind("closemenu-inner", function(){
        tlist.find("li.close:first").css("visibility", "hidden");
      });
      tlist.find("li:first").click(function(){
        tlist.find("li.close:first").css("visibility", "visible");
      });
        
      
      // Add toggle icons:
      table.find("th." + cssclasses.collapsible).each(function(){
        $(this).prepend('<img class="' + cssclasses.img_widget + '" src="img/expanded.png" />')
      });
      
      // Remove the toggle icons at the intersection of the column and row heads:
      var co = table.data('origins'), w = table.data('width'), hw = table.data('headwidth'), hh = table.data('headheight');
      for (x = 0; x < hw; x++) {
        for (y = 0; y < hh; y++) {
          var cell = co[arrpos(x, y,w)];
          if (cell != undefined) cell.children("img." + cssclasses.img_widget).remove();
        }
      }
	
      table.find("thead th." + cssclasses.collapsible + " img." + cssclasses.img_widget).click(function(){
        methods.toggle_col($(this).parent("th"));
      });
      
      table.find("tbody th." + cssclasses.collapsible + " img." + cssclasses.img_widget).click(function(){
          methods.toggle_row($(this).parent("th"));
      });

      return this;
    },
    toggle_col : function(cl){
      /*
       * $.fn.tablemanager('toggle_col')
       * 
       * a method to toggle a single col and all additional rows
       * inherited by the cells' colspans
       */
      var cell = $(cl);
      var colspan = cell.attr("colspan");
      
      var tablebody = cell.parents("table").find("tbody");
      var tablehead = cell.parents("table").find("thead");
      
      var rowindex = cell.data("rowspace");
      var index = cell.data("colspace");
      
      tablehead.find("tr th").each(function(){
        $this = $(this);
        if($this.data("rowspace") == rowindex){
          if($this.data("colspace") >= index && 
             $this.data("colspace") < index + colspan){
            if(!$this.hasClass("col-nonvisible")){
              hide_cell($this);
              $this.parent().nextAll("tr").find("th").each(function(){
                $this = $(this);
                if($this.data("colspace") >= index && 
                   $this.data("colspace") < index + colspan){
                  hide_cell($this);
                  $this.children("*").hide();
                  if ($this.data("applied_li") != undefined){
                    hide_li($this.data("applied_li"));
                    $this.data("applied_li").children("img").css("visibility", "hidden");
                  }
                }
              });
              hide_col(tablebody, index, colspan);
            } else {
              show_cell($this);
              $this.parent().nextAll("tr").find("th").each(function(){
                $this = $(this);
                if($this.data("colspace") >= index && 
                   $this.data("colspace") < index + colspan){
                  show_cell($this);
                  $this.children("*").show();
                  if ($this.data("applied_li") != undefined){
                    show_li($this.data("applied_li"));
                    $this.data("applied_li").children("img").css("visibility", "visible");
                  }
                }
              });
              show_col(tablebody, index, colspan);
            }
          }
        }
      });
      
      toggle_li(cell.data("applied_li"));
      
      return this;
    },
    toggle_row : function(cl){
      /*
       * $.fn.tablemanager('toggle_row')
       * 
       * a method to toggle a row and all additional rows 
       * or inherited by the cell-rows' rowspans
       */
      var cell = $(cl);
      var table = cell.parents("table");
      
      var rowspan  = cell.attr("rowspan");
      var row = cell.data("rowspace");
      var col = cell.data("colspace");

      var toggle = collapsed(cell) ? function(cl) { cl.children("*").show(); } : function(cl) { cl.children("*").hide(); };
      var upto_physrow = get_next_collapsible_physrow(table, col, row);
      var dependent_cells = get_rect_cells_except_origin(table, col, row, table.data('width') - 1, upto_physrow);
      dependent_cells.each( function() { toggle($(this)); } );
      
      return this;
    }
  };
    
  function get_next_collapsible_physrow(table, col, row) {
    var w = table.data('width');
    var h = table.data('height');
    var co = table.data('origins');
    y = row + co[arrpos(col, row, w)].attr('rowspan');
    while (y < h) {
      if (co[arrpos(col, y, w)].attr('class').indexOf(cssclasses.collapsible) >= 0) {
        return y - 1;
      }
      y++;
    }
    return y - 1;
  }
    
  function get_rect_cells_except_origin(table, col1, row1, col2, row2) {
    var out = [];
    var w = table.data('width');
    var co = table.data('origins');
    for (var x = col1; x <= col2; x++) {
      for (var y = row1; y <= row2; y++) {
        var ap = arrpos(x, y, w);
        var cell = co[ap];
        if (cell != undefined) {
          out.push(cell);
        }
      }
    }
    out.shift(); // do not include cell at rectangle's origin 
    return $(out);
  }

  function render_head_list(table){
    var firsthead = table.data('cellrefs')[0];
    var table_id = table.attr('id');
    var ul = $('<ul id="' + table_id + '_colsList"></ul>');
    
    var li = $('<li><img src="img/selectcol.png" alt="select columns" title="select columns"/></li>');
    
    li.append(listify_head_row(table, table.data('headwidth'), table.data('width') - 1, 0));
    
    ul.append(li);
    firsthead.prepend(ul);
    
    var helptext = $( "<div class='tablemanager-helptext'><span class='helptext'>In the following table, click on <img src='img/collapsed.png'/>/<img src='img/expanded.png'/> to hide/display columns/rows or on <img src='img/selectcol.png'/> for a compact column toggler.</span></div>").show();
    
    helptext.find("span").css("background-color", firsthead.css("background-color"));
    var ok = $('<input type="button" id="' + table_id + '_gotit" value="Ok, got it!"/>');
    $(helptext).children("span:last").append(ok);
    ok.click(function(){
      $(".tablemanager-helptext").hide();
    });
    $( helptext ).insertBefore( table );
  }

  function listify_head_row(table, xstart, xend, ystart) {
    var ul = $('<ul class="tablemanager-cols-list"></ul>');
    var w = table.data('width');
    var headheight = table.data('headheight');
    var co = table.data('origins');
    var group_starts = [];
    var found = false;
    var i = 0;
    
    for (var y = ystart; ! found && y < headheight; y++) {
      // collect the collapsible headings in this phyiscal row 
      // (if there aren't any (b/c of rowspans), y will be incremented
      //  and the next physrow will be scanned):
      for (var x = xstart; x <= xend; x++) {
        var cell = co[arrpos(x, y,w)];
        if (cell != undefined) {
          found = true;
          group_starts[i] = cell;
          i++;
        }
      }
      // now iterate over the collected headings and add them as list items
      // to the column selector widget:
      for (var j = 0; j < i; j++) {
        var cell = group_starts[j];
        var li = $('<li class="visible"></li>');
        li.append(cell.html());
        var img = $('<img style="display:inline; padding: 5px; list-style:none;" src="img/expanded.png" />');
        img.data('applied_cell', cell);
        img.click(function(){
          methods.toggle_col($(this).data('applied_cell'));
        });
        li.children('p').each(function(){
          $(this).css('display', 'inline');
        });
        li.prepend(img);
        cell.data('applied_li', li);
        var new_xstart = group_starts[j].data('x-origin');
        var new_xend = xend;
        if (group_starts[j+1] != undefined) {
          new_xend = group_starts[j+1].data('x-origin') - 1;
        }
        // recursively add lists of subordinate headings:
        if (y < headheight - 1) {
          li.append(listify_head_row(table, new_xstart, new_xend, y + 1));
        }
        ul.append(li);
      }
    }
    return ul;
  }

  // doesn't work:
  function fix_row_headers(table) {
    var hw = table.data('headwidth');
    var hh = table.data('headheight');
    var w = table.data('width');
    var h = table.data('height');
    var co = table.data('origins');
    for (var y = hh; y < h; y++) {
      for (var x = 0; x < hw; x++) {
        var cell = co[arrpos(x, y,w)];
        if (cell != undefined) {
          cell.css('position', 'fixed');
        }
      }
    }
  }

  function arrpos(x, y, w) {
    return y * w + x;
  }

  function set_coords(cell, x, y) {
    if (cell.data('colspace') == undefined) {
      cell.data('colspace', x);
      cell.data('rowspace', y);
    }
  }

  // initialize physical grid:
  function init_cellspace(table) {
    
    var rows = table.find("tr");
    
    var cr = []; // cellref (each square on the physical grid knows which cell covers it)
    var co = []; // sparse array with only cellrefs at cells' origins
    var mr = []; // morerows (= rowspan - 1)
    var w = 0;

    var hd = {height: 0, width: 0}; // head dimensions (width, height)
    var inHead = false;

    // first row:
    var cells = $(rows[0]).children("*");
    var j = 0; // j: where each cell starts horizontally, in terms of the physical grid
    for (var k = 0; k < cells.length; k++) {
      var cell = $(cells[k]);
      var cs = cell.attr('colspan');
      var rs1 = cell.attr('rowspan') - 1;
      cell.data('x-origin', j);
      cell.data('y-origin', 0);
      co[j] = cell;
      for(var i = j; i < j + cs; i++) {
        cr[i] = cell;
        mr[i] = rs1;
        set_coords(cell, i, 0);
        w++;
      }
      j = j + cs; // next cell starts
      var type = cell[0].localName;
      inHead = $(rows[0]).parent("thead").length == 1;
      if (! inHead && type == 'th') { hd.width = j + 1; }
    }
    if (inHead) { hd.height = 1; }

    for (var y = 1; y < rows.length; y++) {
      var cellcounter = 0;
      for(var j = 0; j < w; j++) {
        if (mr[arrpos(j, y - 1, w)] > 0) {
          var ap = arrpos(j, y, w);
          var ap1 = arrpos(j, y - 1, w);
          cr[ap] = cr[ap1];
          mr[ap] = Math.max(0, mr[ap1] - 1);
        } else {
          var cell = $(rows[y]).children("*:nth-child(" + (cellcounter + 1) + ")");
          inHead = $(rows[y]).parent("thead").length == 1;
          if (cell[0] != undefined) {
            var type = cell[0].localName;
          } else {
            console.log("No cell #" + (cellcounter + 1) + " at row " + (y + 1) +"?");
          }
          var cs = cell.attr('colspan');
          var rs1 = cell.attr('rowspan') - 1;
          var ap = arrpos(j, y, w);
          co[ap] = cell;
          cell.data('x-origin', j);
          cell.data('y-origin', y);
          for(var i = j; i < j + cs; i++) {
            ap = arrpos(i, y, w);
            cr[ap] = cell;
            mr[ap] = rs1;
            set_coords(cell, i, y);
          }
          j = j + cs - 1; // - 1 here because it will be incremented after the loop anyway
          if (! inHead && type == 'th') { hd.width = Math.max(hd.width, j + 1); }
          cellcounter++;
        }
      }
      if (inHead) { hd.height = hd.height + 1; }
    }
    
    table.data('width', w);
    table.data('height', y);
    table.data('headwidth', hd.width);
    table.data('headheight', hd.height);
    table.data('cellrefs', cr);
    table.data('origins', co);
    return cr;
  }
    
  function toggle_li(listitem){
    if (listitem.hasClass("visible")){
      hide_li(listitem);
    } else {
      show_li(listitem);
    }
  }
  
  function show_li(listitem){
    listitem.removeClass("nonvisible").addClass("visible");
    listitem.children("img").attr("src", "img/expanded.png");
    listitem.children("ul").show();
    //  listitem.children("p, span").css("color","#000");
  }
  
  function hide_li(listitem){
    listitem.removeClass("visible").addClass("nonvisible");
    listitem.children("img").attr("src", "img/collapsed.png");
    listitem.children("ul").hide();
    //  listitem.children("p, span").css("color","#ccc");
  }

  function hide_col(tbody, index, colspan){
    tbody.find("td").each(function(){
    if($(this).data("colspace") >= index && 
       $(this).data("colspace") < index + colspan){
      hide_cell($(this));
    } 
    });
  }

  function show_col(tbody, index, colspan){
    tbody.find("td").each(function(){
      if($(this).data("colspace") >= index && $(this).data("colspace") < index + colspan){
        show_cell($(this));
      }
    });
  }

  function collapsed(cell) {
    img = cell.find("img." + cssclasses.img_widget);
    if (img.attr("src") == "img/collapsed.png") {
      img.attr("src", "img/expanded.png");
      return true;
    } else {
      img.attr("src", "img/collapsed.png");
      return false;
    }
  };      
  
  function toggle_cell(cell){
    if (cell.find("img." + cssclasses.img_widget).attr("src", "img/collapsed.png")) {
      show_cell(cell);
    } else {
      hide_cell(cell);
    }
  };

  function hide_cell(col){
    if(col.is("th")){
      col.find("img." + cssclasses.img_widget).attr("src", "img/collapsed.png");
    } 
    col.addClass("col-nonvisible").removeClass("col-visible").removeClass("visible");
    //  col.children("p").addClass("nonvisible").removeClass("visible");
    col.children("p").hide();
  };
  
  function show_cell(col){
    if(col.is("th")){
      col.find("img." + cssclasses.img_widget).attr("src", "img/expanded.png");
    }
    col.addClass("col-visible").removeClass("col-nonvisible").removeClass("nonvisible");
    //  col.children("p").addClass("visible").removeClass("nonvisible");
    col.children("p").show();
  };
  
})(jQuery);
