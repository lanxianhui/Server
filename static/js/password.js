'use strict';
/* global $ */

const zxcvbn = require('zxcvbn');

function checkMatch(){
	$('#submit').prop('title',"You need to type your password again before you can save it. ");
	
	// They match
	if ( $('#p1').val() === $('#p2').val() ) {
		$('#submit').prop('disabled',false).prop('title',"Click here to save your password. ");
	}
	
	// User has retyped, but they don't match yet
	else if ($('#p2').val()!=='') {
		$('#password-help').text("Those passwords don't match... ").css({'color':'#fb6e3d'});
		$('#submit').prop('disabled',true).prop('title',"You need to type the same password twice before you can save it. ");
	}
	
}

// On page load
$(function(){
	
	// On typing password
	$('.password').keyup(function(){
		
		// Nothing entered
		if ( $('#p1').val()==='' && $('#p2').val()==='' ){
			$('#password-help').hide();
			$('#submit').prop('disabled',true).prop('title',"You need to enter a password first. ");
		}
		
		// Only second password entered
		else if ($('#p1').val()==='') {
			$('#password-help').show().text("Those passwords don't match... ");
			$('#submit').prop('disabled',true).prop('title',"You need to type the same password twice correctly before you can save it. ");
		}
		
		// At least first password entered
		else {
			$('#password-help').show();
			
			// Check first password
			var zxcvbnResult = zxcvbn($('#p1').val());
			
			// Not good enough
			if (zxcvbnResult.crack_times_seconds.online_no_throttling_10_per_second < 3600) { // Less than an hour
				$('#password-help').text("That password is way too common or simple. You may not use it for Tracman and should not use it anywhere. ").css({'color':'#fb6e3d'});
				$('#submit').prop('disabled',true).prop('title',"You need to come up with a better password. ");
			}
			else if (zxcvbnResult.crack_times_seconds.online_no_throttling_10_per_second < 86400) { // Less than a day
				$('#password-help').text("That password is pretty bad.  It could be cracked in "+zxcvbnResult.crack_times_display.online_no_throttling_10_per_second+".  Try adding more words, numbers, or symbols. ").css({'color':'#fb6e3d'});
				$('#submit').prop('disabled',true).prop('title',"You need to come up with a better password. ");
			}
			else if (zxcvbnResult.crack_times_seconds.online_no_throttling_10_per_second < 864000) { // Less than ten days
				$('#password-help').text("That password isn't good enough.  It could be cracked in "+zxcvbnResult.crack_times_display.online_no_throttling_10_per_second+".  Try adding another word, number, or symbol. ").css({'color':'#fb6e3d'});
				$('#submit').prop('disabled',true).prop('title',"You need to come up with a better password. ");
			}
			
			// Good enough
			else if (zxcvbnResult.crack_times_seconds.online_no_throttling_10_per_second <= 2592000) { // Less than thirty days
				$('#password-help').text("That password is good enough, but it could still be cracked in "+zxcvbnResult.crack_times_display.online_no_throttling_10_per_second+". ").css({'color':'#eee'});
				checkMatch();
			}
			else if (zxcvbnResult.crack_times_seconds.online_no_throttling_10_per_second <= 1314000) { // Less than a year
				$('#password-help').text("That password is good.  It would take "+zxcvbnResult.crack_times_display.online_no_throttling_10_per_second+" to crack. ").css({'color':'#8ae137'});
				checkMatch();
			}
			else { // Long ass time
				$('#password-help').text("That password is great!  It could take "+zxcvbnResult.crack_times_display.online_no_throttling_10_per_second+" to crack!").css({'color':'#8ae137'});
				checkMatch();
			}
		}
		
	});
	
	// On checking 'show'
	$('#show').click(function(){
		if ($(this).is(':checked')) {
			$('.password').attr('type','text');
		} else {
			$('.password').attr('type','password');
		}
	});
	
});