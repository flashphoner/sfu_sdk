'use strict'

const createMetricTable = function() {
    const updateMetricTable = function(data, caption) {
        metricTableCaption.innerHTML = caption;
        metricTable.clear();
        data.forEach(function(value) {
            metricTable.row.add(value);
        });
        metricTable.draw();
    }

    //setup table
    const metricTable = $('#metricTable').DataTable({
        "columns": [
            {
                "className":      'details-control',
                "orderable":      false,
                "data":           null,
                "defaultContent": ''
            },
            {"data": "metric"},
            {"data": "type"},
            {"data": "participant"},
            {"data": "id"},
            {"data": "quality"}
        ]
    });

    const format = function(d) {
        let details =  '<table cellpadding="5" cellspacing="0" border="0" style="padding-left:50px;">';
        for (const [key, value] of Object.entries(d.details)) {
            details += '<tr>'+
                '<td>'+ key + '</td>'+
                '<td>'+ value + '</td>'+
                '</tr>';
        }
        details +='</table>';
        return details;
    }

    // Add event listener for opening and closing details
    $('#metricTableBody').on('click', 'td.details-control', function () {
        var tr = $(this).closest('tr');
        var row = metricTable.row( tr );

        if ( row.child.isShown() ) {
            // This row is already open - close it
            row.child.hide();
            tr.removeClass('shown');
        }
        else {
            // Open this row
            row.child( format(row.data()) ).show();
            tr.addClass('shown');
        }
    });

    const metricTableCaption = document.getElementById("metricTable").createCaption();



    return {
        updateMetricTable: updateMetricTable
    }
}

module.exports = {
    createMetricTable: createMetricTable
}