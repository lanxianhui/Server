'use strict';
/* global $ io google mapuser userid disp noHeader */


// Variables
var map, pano, marker, elevator,
	mapElem = document.getElementById('map'),
	panoElem = document.getElementById('pano');
const socket = io('//'+window.location.hostname);

function waitForElements(vars,cb){
	if (vars.every(function(v){ return v!==undefined; })){
		cb();
	} else {
		setTimeout(waitForElements, 100);
	}
}

function onConnect(socket,userid,mapuserid) {
	
	// Can get location
	socket.emit('can-get', mapuserid );
	console.log("🚹 Receiving updates for",mapuserid);

	// Can set location too
	if (mapuserid==userid) { 
		socket.emit('can-set', userid );
		console.log("🚹 Sending updates for",userid);
	}
	
}

// socket.io stuff
socket
	.on('connect', function(){
		console.log("⬆️ Connected!");
		waitForElements([mapuser,userid], function() {
			onConnect(socket,userid,mapuser._id);
		});
	})
	.on('disconnect', function(){
		console.log("⬇️ Disconnected!");
	})
	.on('error', function (err){
		console.error('⛔️',err.message);
	});

// Parse location
function parseLoc(loc) {
	loc.spd = (mapuser.settings.units=='standard')?parseFloat(loc.spd)*2.23694:parseFloat(loc.spd);
	loc.dir = parseFloat(loc.dir);
	loc.lat = parseFloat(loc.lat);
	loc.lon = parseFloat(loc.lon);
	loc.time = new Date(loc.time).toLocaleString();
	loc.glatlng = new google.maps.LatLng(loc.lat, loc.lon);
	return loc;
}

// Show/hide map if location is set/unset
function toggleMaps(loc) {
	if (loc.lat===0&&loc.lon===0) {
		$('#map').hide();
		$('#pano').hide();
		$('#notset').show();
	} else {
		$('#map').show();
		$('#pano').show();
		$('#notset').hide();
	}
}
// Toggle maps on page load
$(function() {
	toggleMaps(mapuser.last);
});

// Google maps API callback
window.gmapsCb = function() {
	
	// Create map
	if (disp!='1'||!mapuser.settings.showStreetview) {
		map = new google.maps.Map( mapElem, {
			center: new google.maps.LatLng( mapuser.last.lat, mapuser.last.lon ),
			panControl: false,
			scaleControl: mapuser.settings.showScale,
			draggable: false,
			zoom: mapuser.settings.defaultZoom,
			streetViewControl: false,
			zoomControlOptions: {position: google.maps.ControlPosition.LEFT_TOP},
			mapTypeId: (mapuser.settings.defaultMap=='road')?google.maps.MapTypeId.ROADMAP:google.maps.MapTypeId.HYBRID
		});
		marker = new google.maps.Marker({
			position: { lat:mapuser.last.lat, lng:mapuser.last.lon },
			title: mapuser.name,
			map: map,
			draggable: false
		});
		map.addListener('zoom_changed',function(){
			map.setCenter(marker.getPosition());
		});
		
		// Create iFrame logo
		if (noHeader.length) {
			var logoDiv = document.createElement('div');
			logoDiv.className = 'map-logo';
			logoDiv.innerHTML = '<a href="https://tracman.org/">'+
				'<img src="https://tracman.org/static/img/style/logo-28.png" alt="[]">'+
				'Tracman</a>';
			map.controls[google.maps.ControlPosition.BOTTOM_LEFT].push(logoDiv);
		}
		
		// Create update time block
		var timeDiv = document.createElement('div');
		timeDiv.className = 'tim';
		if (mapuser.last.time) {
			timeDiv.innerHTML = 'location updated '+new Date(mapuser.last.time).toLocaleString();
		}
		map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(timeDiv);
		
		// Create speed block
		if (mapuser.settings.showSpeed) {
			const speedSign = document.createElement('div'),
				speedLabel = document.createElement('div'),
				speedText = document.createElement('div'),
				speedUnit = document.createElement('div');
			speedLabel.className = 'spd-label';
			speedLabel.innerHTML = 'SPEED';
			speedText.className = 'spd';
			speedText.innerHTML = (mapuser.settings.units=='standard')?(parseFloat(mapuser.last.spd)*2.23694).toFixed():mapuser.last.spd.toFixed();
			speedUnit.className = 'spd-unit';
			speedUnit.innerHTML = (mapuser.settings.units=='standard')?'m.p.h.':'k.p.h.';
			speedSign.className = 'spd-sign';
			speedSign.appendChild(speedLabel);
			speedSign.appendChild(speedText);
			speedSign.appendChild(speedUnit);
			map.controls[google.maps.ControlPosition.TOP_RIGHT].push(speedSign);
		}
		
		// Create altitude block
		if (mapuser.settings.showAlt) {
			var elevator = new google.maps.ElevationService;
			const altitudeSign = document.createElement('div'),
				altitudeLabel = document.createElement('div'),
				altitudeText = document.createElement('div'),
				altitudeUnit = document.createElement('div');
			altitudeLabel.className = 'alt-label';
			altitudeText.className = 'alt';
			altitudeUnit.className = 'alt-unit';
			altitudeSign.className = 'alt-sign';
			altitudeText.innerHTML = '';
			altitudeLabel.innerHTML = 'ALTITUDE';
			getAltitude(new google.maps.LatLng(mapuser.last.lat,mapuser.last.lon), elevator, function(alt) {
				if (alt) { altitudeText.innerHTML = (mapuser.settings.units=='standard')?(alt*3.28084).toFixed():alt.toFixed(); }
			});
			altitudeUnit.innerHTML = (mapuser.settings.units=='standard')?'feet':'meters';
			altitudeSign.appendChild(altitudeLabel);
			altitudeSign.appendChild(altitudeText);
			altitudeSign.appendChild(altitudeUnit);
			map.controls[google.maps.ControlPosition.TOP_RIGHT].push(altitudeSign);
		}
	}
		
	// Create streetview
	updateStreetView(parseLoc(mapuser.last),10);
};

// Get location
socket.on('get', function(loc) {
	
	loc = parseLoc(loc);
	
	// Update street view
	if (disp!='1' || !mapuser.settings.showStreetview) {
		$('.tim').text('location updated '+loc.time);
		if (mapuser.settings.showSpeed) { $('.spd').text(loc.spd.toFixed()); }
		if (mapuser.settings.showAlt) {
			getAltitude({lat:loc.lat,lng:loc.lon}, elevator, function(alt) {
				if (alt) { $('.alt').text((mapuser.settings.units=='standard')?(alt*3.28084).toFixed():alt.toFixed()); }
			});
		}
		toggleMaps(loc);
		map.setCenter({lat:loc.lat,lng:loc.lon});
		marker.setPosition({lat:loc.lat,lng:loc.lon});
	}
	updateStreetView(loc,10);
	
	console.log("🌐️ Got location:",loc.lat+", "+loc.lon);
});

// Check altitude
function getAltitude(loc,elev,cb){
	elev = elev || new google.maps.ElevationService;
	elev.getElevationForLocations({
		'locations': [loc]
	}, function(results, status) {
		if (status === google.maps.ElevationStatus.OK && results[0]) {
			cb(results[0].elevation);
		}
	});
}

// Get street view imagery
function getStreetViewData(loc,rad,cb) {
	if (!sv) { var sv=new google.maps.StreetViewService(); }
	sv.getPanorama({location:{lat:loc.lat,lng:loc.lon},radius:rad},function(data,status){
		if (status!==google.maps.StreetViewStatus.OK){ console.error(new Error('⛔️ Street view not available:',status).message); }
		else { cb(data); }
	});
}

// Update streetview
function updateStreetView(loc) {
	
	// Moving
	if (loc.spd>1) {
		if (mapuser.settings.showStreetview && disp!='0') {
			var imgElem = document.getElementById('panoImg');
			getStreetViewData(loc, 50, function(data){
				if (!imgElem) {
					// Create image
					pano = undefined;
					$('#pano').empty();
					$('#pano').append($('<img>',{
						alt: 'Street view image',
						src: 'https://maps.googleapis.com/maps/api/streetview?size=800x800&location='+loc.lat+','+loc.lon+'&fov=90&heading='+loc.dir+'&key={{api}}',
						id: 'panoImg'
					}));
				}
				// Set image
				$('#panoImg').attr('src','https://maps.googleapis.com/maps/api/streetview?size='+$('#pano').width()+'x'+$('#pano').height()+'&location='+data.location.latLng.lat()+','+data.location.latLng.lng()+'&fov=90&heading='+loc.dir+'&key={{api}}');
			});
		}
	}
	
	// Not moving and pano not set
	else if (pano==null) {
		getStreetViewData(loc, 50, function(data){
			// Create panorama
			$('#pano').empty();
			const panoOptions = {
				panControl: false,
				zoomControl: false,
				addressControl: false,
				linksControl: false,
				motionTracking: false,
				motionTrackingControl: false
			};
			pano = new google.maps.StreetViewPanorama(panoElem, panoOptions);
			// Set panorama
			pano.setPano(data.location.pano);							
			pano.setPov({
				pitch: 0,
				heading: Math.atan((loc.lon-data.location.latLng.lng())/(loc.lat-data.location.latLng.lat()))*(180/Math.PI)
			});
		});
	}
	
}
