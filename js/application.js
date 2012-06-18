$(document).ready(function(){
  $('table.tablemanager').each(function() {
    $.fn.tablemanager($(this), {mincols: 5});
  });
});
