'use strict';
/* global $ */

$(function(){
	
	// On clocking 'show'
	$('#show').click(function(){
		if ($('#password').attr('type')==="password") {
			$('#password').attr('type','text');
		} else {
			$('#password').attr('type','password');
		}
	});
	
});
