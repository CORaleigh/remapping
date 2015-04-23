var config = {
	feedbackLayer: {
		url: "http://maps.raleighnc.gov/arcgis/rest/services/Planning/UDO_Feedback/FeatureServer/0"
	},
	udoService: {
		url: "http://maps.raleighnc.gov/arcgis/rest/services/Planning/UDO/MapServer",
		layerIds: [0]
	},
	parcels: {
		url: "http://maps.raleighnc.gov/arcgis/rest/services/Parcels/MapServer"
	},
	overlays: {
		url: "http://maps.raleighnc.gov/arcgis/rest/services/Planning/Overlays/MapServer"
	},
	addresses: {
		url: "http://maps.raleighnc.gov/arcgis/rest/services/Addresses/MapServer"
	},
	geometry: {
		url: "http://maps.raleighnc.gov/arcgis/rest/services/Utilities/Geometry/GeometryServer"
	},
	conditionalDocs: {
		url: "http://maps.raleighnc.gov/planning/conditionaluses/"
	}
}

$(document).ready(function () {
	var current,
		proposed,
		listeners = [],
		mapPoint,
		feedbackLayer,
		json,
		types,
		locMarkersC,
		locMarkersP,
		addressText = "",
		lastAction = "",
		info = {}

	function setMapView(point) {
		current.setView([point.y, point.x], 16);
		proposed.setView([point.y, point.x], 16);
	}

	function getInfo(point) {
		info = {};
		_gaq.push(['_trackEvent', 'Search', 'Location', '"coordinates":['+point.x+', '+point.y+']']);
		updateLocation(point);
		updateLocationMarkers(point);
		getCurrentZoning(point);

		searchParcel(point);
	}

	function mapClickHandler (e) {
		lastAction = "click";
		var point = {x: e.latlng.lng, y: e.latlng.lat};
		_gaq.push(['_trackEvent', 'Search', 'Type', 'Map Click']);
		getInfo(point);
	}

	function addMapClick () {
		proposed.on("click", mapClickHandler);
		current.on("click", mapClickHandler);
	}

	function removeMapClick() {
		proposed.off("click", mapClickHandler);
		current.off("click", mapClickHandler);
	}

	function showAddressAlert (address) {
		var mql = window.matchMedia("(max-width: 992px)");
		$("#addressAlert").css("visibility", "visible");
		$("#addressAlert").show();
		$("#addressAlert strong").text(address);
	}

	function retrievedParcel(data) {
		$("#searchInput").typeahead('val', '');
		if (data.results.length > 0) {
			var geom = data.results[0].geometry;
			//if (lastAction === "click") {
			addressText = data.results[0].attributes['Site Address'];
			//}
			updateLocationText();
			$(geom.rings).each(function (i, r) {
				var ring = [];
				$(r).each(function(j, p) {

					ring.push({lon:p[0], lat:p[1]})

				});
				L.polygon(ring).addTo(locMarkersC);
				L.polygon(ring).addTo(locMarkersP);
			});
		} else {
			if (lastAction === "click") {
				addressText = "Right-of-Way";
			}
			updateLocationText();
		}
	}

	function searchParcel(point) {
		$.ajax({url: config.parcels.url + "/identify",
			dataType: "json",
			data: {
				geometry: point.x + ',' + point.y,
				geometryType: 'esriGeometryPoint',
				sr: 4236,
				tolerance: 3,
				layers: "all:0,1",
				mapExtent: point.x-1 +","+point.y-1+","+point.x+1+","+point.y+1,
				imageDisplay: proposed.getSize().x+","+ proposed.getSize().y+",96",
				returnGeometry: true,
				f: "json"
			}
		}).done(retrievedParcel);
	}

	function updateLocationMarkers(point) {
		var icon = L.icon({
			iconUrl: 'img/location.png',
			iconSize: [14,14]
		});
		locMarkersC.clearLayers();
		locMarkersC.addLayer(L.marker([point.y, point.x], {icon:icon}));
		locMarkersP.clearLayers();
		locMarkersP.addLayer(L.marker([point.y, point.x], {icon:icon}));

	}

	function updateLocationText() {
		$("#location").html(addressText);
		showAddressAlert(addressText);
	}
	function updateLocation (point) {
			var lngLat = [point.x, point.y];
			mapPoint = point;
			//$("#locMessage").text(Math.round(lngLat[1]* 1000)/1000 + ", " + Math.round(lngLat[0]* 1000)/1000);
			updateLocationMarkers(point);
			updateLocationText();
			$("#addPointButton").html('	Change  <span class="glyphicon glyphicon-pushpin"></span>');
	}

	function setLocationHandler (e) {
		updateLocation({x: e.latlng.lng, y: e.latlng.lat});
		$("#mapModal").modal("toggle");
		proposed.off("click", setLocationHandler);
		$("#currentMap").css("opacity", 1);
		addMapClick();
	}

function getConditionalUrl (zCase) {
	var arr = zCase.split("-"),
		year = arr[2];
	return config.conditionalDocs.url+year+"/"+arr[0]+"-"+arr[1]+"-"+year.slice(-2)+".pdf";
}

function buildOverlayInfo (div, overlays) {
	if (overlays.length > 0) {
		div.append('<p class="lead"><small>'+((overlays.length > 1) ? 'Overlays':'Overlay')+'</small></p>');
		matches = $(json).filter(function () {
			return ($.inArray(this.overlay, overlays) > -1);
		});
		$(matches).each(function(i,match) {
			div.append("<p>"+ match.descr + " <a href='" + match.url + "' target='_blank'>Learn More</a></p>");
		});
	}
}



function buildProposedInfo () {
	var div = $("#proposedInfo");
	if (info.proposed) {
		var matches = $(json).filter(function () {
			if (info.proposed.type === this['new'] || info.proposed.height === this.height || info.proposed.frontage === this.frontage) {
				return true;
			} else {
				return false;
			}
		});

		$(matches).each(function (i, match) {
			if (match.height) {
				div.append('<p class="lead">Height</p>');
			} else if (match.frontage) {
				div.append('<p class="lead">Frontage</p>');
			} else if (match['new']) {
				div.append('<p class="lead"><small>Base Zoning</small></p>');
			}
			div.append("<p>"+ match.descr + " <a href='" + match.url + "' target='_blank'>Learn More</a></p>");
		});
		if (info.proposed.overlays) {
			buildOverlayInfo(div, info.proposed.overlays);
		}
	}
}

function buildOverlayDescription (overlays) {
	var text = "";
	$(overlays).each(function (i, o) {
		if (i === 0) {
			text = " with "+o;
		} else if (i === overlays.length -1){
			text += " and "+o;
		} else {
			text += ", "+o;
		}
	});
	return text;
}

function buildProposedDescription () {
	var zoning = "Data not available",
		div = $("#proposedDesc");
	if (info.proposed) {
		$(".page-header", div.parent()).remove();
		if (info.proposed.label === info.current.label && info.proposed.overlays.toString() === info.current.overlays.toString()) {
			div.parent().prepend("<div class='page-header'><h4>"+info.proposed.label+"<small>NO CHANGE PROPOSED</small></h4></div>");
		} else {
			div.parent().prepend("<div class='page-header'><h4>"+info.proposed.label+"</h4></div>");
		}
		_gaq.push(['_trackEvent', 'Proposed Zoning', 'Label', info.proposed.label]);
		zoning = info.proposed.typeDecode + " (" + info.proposed.type + ")";
		if (info.proposed.height) {
			zoning += " with Height up to " + info.proposed.height + " Stories";
		}
		if (info.proposed.frontageDecode) {
			zoning += " with " + info.proposed.frontageDecode + " Frontage";
		}
		if (info.proposed.overlays) {
			zoning += buildOverlayDescription (info.proposed.overlays);
		}
		zoning += ((info.proposed.conditional) ? ", Conditional Use": "");
		_gaq.push(['_trackEvent', 'Proposed Zoning', 'Description', zoning]);
		div.html("<span>"+zoning+"</span>");
		if (info.proposed.conditional && info.zoningCase) {
			div.html(div.html() + "<p/><a class='pdf-link' href='"+getConditionalUrl(info.zoningCase)+"' target='_blank'>View Conditional Use Details</a>");
		}
	}
	buildProposedInfo();
}



function buildCurrentInfo () {
	var div = $("#currentInfo");
	if (info.current) {
		var matches = $(json).filter(function () {
			return info.current.type.replace("CUD ", "").replace("-CU", "") === this.old;
		});
		$(matches).each(function (i, match) {
			div.append('<p class="lead"><small>Zoning</small></p>');
			div.append("<p>"+ match.descr + " <a href='" + match.url + "' target='_blank'>Learn More</a></p>");
		});
		if (info.current.overlays) {
			buildOverlayInfo(div, info.current.overlays);
		}
	}
}


function buildCurrentDescription () {
	var zoning = "Data not available",
		div = $("#currentDesc");
	if (info.current) {
		$(".page-header", div.parent()).remove();
		div.parent().prepend("<div class='page-header'><h4>"+info.current.label+"</h4></div>");
		_gaq.push(['_trackEvent', 'Current Zoning', 'Label', info.current.label]);
		zoning = ((info.current.conditional) ? "Conditional Use ": "");
		var matches = $(json).filter(function () {
			return info.current.type.replace("CUD ", "").replace("-CU", "") === this.old;
		});
		if (matches.length > 0) {
			var match = matches [0];
			zoning += match.name+" ("+info.current.type+")";
		}
		if (info.current.overlays) {
			zoning += buildOverlayDescription (info.current.overlays);
		}
		div.html("<span>"+zoning+"</span>");
		_gaq.push(['_trackEvent', 'Current Zoning', 'Description', zoning]);
		if (info.current.conditional && info.zoningCase) {
				div.html(div.html() + "<p/><a class='pdf-link' href='"+getConditionalUrl(info.zoningCase)+"' target='_blank'>View Conditional Use Details</a>");
		}
	}
	buildCurrentInfo();
}

function clearAllInfo () {
	$("#currentDesc").empty();
	$("#currentInfo").empty();
	$("#proposedDesc").empty();
	$("#proposedInfo").empty();
}

function reportInfo () {
	clearAllInfo();
	buildCurrentDescription();
	buildProposedDescription();
}

function getZoningCases (point, element) {
	var bounds = current.getBounds();
	$.ajax({
		url: config.udoService.url + '/2/query',
		dataType: 'json',
		data: {f: 'json',
		geometry: point.x + ',' + point.y,
		geometryType: 'esriGeometryPoint',
		inSR: 4236,
		outFields: "ZONE_CASE",
		returnGeometry: false
				},
	})
	.done(function (fs) {
		if (fs.features.length > 0) {
			info.zoningCase = fs.features[0].attributes.ZONE_CASE;
		}
		reportInfo();
	});
}


	function getOverlays (point) {
		var bounds = current.getBounds();
		$.ajax({
			url: config.overlays.url + '/identify',
			dataType: 'json',
			data: {f: 'json',
				geometry: point.x + ',' + point.y,
				geometryType: 'esriGeometryPoint',
				sr: 4236,
				layers: "all",
				tolerance: 1,
				mapExtent: bounds.getWest()+","+bounds.getSouth()+","+bounds.getEast()+","+bounds.getNorth(),
				imageDisplay: $("#currentMap").width()+","+$("#currentMap").height()+",96",
				returnGeometry: false
			},
		})
		.done(function(fs){
			if (info.current && info.proposed) {
				info.current.overlays = [];
				info.proposed.overlays = [];
				if (fs.results.length > 0) {
					$(fs.results).each(function (i,f) {
						info.current.overlays.push(f.attributes['Overlay District']);
						if ($.inArray(f.attributes['Overlay District'], ["DOD","PBOD","PDD","SHOD-3","SHOD-4"]) === -1) {
							if (f.attributes.OBJECTID === "2965") {
								f.attributes['Overlay District'] = "SHOD-1";
							}
							info.proposed.overlays.push(f.attributes['Overlay District']);
						}
					});
				}
				getZoningCases(point);				
			} else {
				$("#currentDesc").html("No information available");
				$("#currentInfo").empty();
				$("#proposedDesc").html("No information available");
				$("#proposedInfo").empty();				
			}
		});
	}
	function getProposedZoning (point) {
		$.ajax({
			url: config.udoService.url + '/1/query',
			dataType: 'json',
			data: {f: 'json',
				geometry: point.x + ',' + point.y,
				geometryType: 'esriGeometryPoint',
				inSR: 4236,
				outFields: "*",
				returnGeometry: false
			},
		})
		.done(function(fs) {
			if (fs.features.length > 0) {
				feature = fs.features[0];
				atts = feature.attributes;
				info.proposed = {};
				info.proposed.typeDecode = atts.ZONE_TYPE_DECODE;
				info.proposed.frontageDecode = atts.FRONTAGE_DECODE;
				info.proposed.frontage = atts.FRONTAGE;
				info.proposed.type = atts.ZONE_TYPE;
				info.proposed.height = atts.HEIGHT;
				info.proposed.label = atts.LABEL;
				info.proposed.conditional = (atts.CONDITIONAL == "-CU")?true:false;
			}
			getOverlays(mapPoint);
		});
	}
	function getCurrentZoning (point) {
		$.ajax({
			url: config.udoService.url + '/0/query',
			dataType: 'json',
			data: {f: 'json',
				geometry: point.x + ',' + point.y,
				geometryType: 'esriGeometryPoint',
				inSR: 4236,
				outFields: "ZONE_TYPE",
				returnGeometry: false
			},
		})
		.done(function(fs) {
			if (fs.features.length > 0) {
				var feature = fs.features[0];
				info.current = {};
				info.current.type = feature.attributes.ZONE_TYPE;
				info.current.label = feature.attributes.ZONE_TYPE;
				if (feature.attributes.ZONE_TYPE.indexOf("CUD ") > -1 || feature.attributes.ZONE_TYPE.indexOf("-CU") > -1) {
					info.current.conditional = true;
				} else {
					info.current.conditional = false;
				}
			}
			getProposedZoning(point);
		});
	}

	function displayPoint (point, type) {
		lastAction = "search";
		_gaq.push(['_trackEvent', 'Search', type]);
		getInfo(point);
		setMapView(point);		
	}
	function searchByAddress (data) {
		$.ajax({
			url: config.addresses.url + "/0/query",
			type: 'GET',
			dataType: 'json',
			data: {f: 'json',
				where: "ADDRESS = '" + data.value + "'",
				returnGeometry: true,
				outSR: 4326
			},
		})
		.done(function(data) {
			if (data.features.length > 0) {
				var point = data.features[0].geometry;
				displayPoint(point, "Address");
			}
		});
	}

	function searchByPIN (data) {
		$.ajax({
			url: config.parcels.url + "/0/query",
			type: 'GET',
			dataType: 'json',
			data: {f: 'json',
				where: "PIN_NUM = '" + data.value + "'",
				returnGeometry: true,
				outSR: 4326
			},
		})
		.done(function(data) {
			$.ajax({
				url: config.geometry.url + '/labelPoints',
				type: 'POST',
				dataType: 'json',
				data: {f: 'json',
					polygons: '[' + JSON.stringify(data.features[0].geometry) + ']',
					sr: 4326
				},
			})
			.done(function(data) {
				if (data.labelPoints.length > 0) {
					var point = data.labelPoints[0];
					displayPoint(point, 'PIN');
				}
			});				
		});	
	}

	function typeaheadSelected (obj, data, dataset) {
		if (dataset === "Addresses") {
			searchByAddress(data);
		} else if (dataset === "PIN") {
			searchByPIN(data);
		}
	}
	function addressFilter (resp) {
		var data = []
		if (resp.features.length > 0) {
			$(resp.features).each(function (i, f) {
				data.push({value:f.attributes['ADDRESS']});
			});
		}
		return data;
	}

	function pinFilter (resp) {
		var data = []
		if (resp.features.length > 0) {
			$(resp.features).each(function (i, f) {
				data.push({value:f.attributes.PIN_NUM});
			});
		}

		return data;
	}
	function setTypeahead () {
		var addresses = new Bloodhound({
			datumTokenizer: function (datum) {
		        return Bloodhound.tokenizers.whitespace(datum.value);
		    },
		    queryTokenizer: Bloodhound.tokenizers.whitespace,
			remote: {
				url: config.addresses.url + "/0/query?orderByFields=ADDRESS&returnGeometry=false&outFields=ADDRESS&returnDistinctValues=false&f=json",
				filter: addressFilter,
				replace: function(url, uriEncodedQuery) {
				      var newUrl = url + '&where=ADDRESSU like ' + "'" + uriEncodedQuery.toUpperCase() +"%'";
				      return newUrl;
				}
			}
		});
		var pin = new Bloodhound({
			datumTokenizer: function (datum) {
		        return Bloodhound.tokenizers.whitespace(datum.value);
		    },
		    queryTokenizer: Bloodhound.tokenizers.whitespace,
			remote: {
				url: config.parcels.url + "/0/query?orderByFields=PIN_NUM&returnGeometry=false&outFields=PIN_NUM&returnDistinctValues=true&f=json",
				filter: pinFilter,
				replace: function (url, uriEncodedQuery) {
					var newUrl = url + "&where=PIN_NUM LIKE '" + uriEncodedQuery + "%' OR PIN_NUM LIKE '0" + parseInt(uriEncodedQuery).toString() + "%'";
					return newUrl;
				}
			}
		});	
		addresses.initialize();
		pin.initialize();
		$("#searchInput").typeahead({hint: true, highlight: true, minLength: 1}, 
			{name:'Addresses', 
			displayKey:'value', 
			source:addresses.ttAdapter(),
			templates: {
				header: "<h5>Addresses</h5>"
			}},
			{name:'PIN', 
			displayKey:'value', 
			source:pin.ttAdapter(),
			templates: {
				header: "<h5>PIN</h5>"
			}}).on("typeahead:selected", typeaheadSelected);
	}

	setTypeahead();

	$(".btn-group>ul>li").click(function () {
		if ($(this).index() > 0 || mapPoint) {
			$("#"+$(this).data("modal")).modal("show");
		} else {
			$("#warningModal").modal("show");
		}
	});

	$("#addPointButton").click(function () {
		$("#mapModal").modal("toggle");
		$("#currentMap").css("opacity", 0.3);
		removeMapClick();
		proposed.on("click", setLocationHandler);
	});


	//validation error functions//
	function placeErrors (error, element) {
		var group = $(element).closest('.form-group div').addClass("has-error");
		$('.help-block', group).remove();
		group.append("<span class='help-block'>"+error.text()+"</span>");
	}

	function removeErrors (label, element) {
		var group = $(element).closest('.form-group div').removeClass("has-error");
		$('.help-block', group).remove();
	}

	function submitForm () {
		var edit = {geometry: mapPoint,
				attributes: {
			 		"NAME":$("#inputName").val(),
			 		"EMAIL":$("#inputEmail").val(),
			 		"ADDRESS":$("#location").text(),
			 		"OWN":$('.btn-group[name="owner"]>label.active').index(),
			 		"FEEDBACK":$("#commentArea").val(),
			 		"TYPE":$("option:selected", "#typeSelect").val(),
					 "PROPOSED":$("#proposedDesc span").text(),
					 "EXISTING":$("#currentDesc span").text()
				}
			};
		$.ajax({
			url: config.feedbackLayer.url + '/addFeatures',
			type: 'POST',
			dataType: 'json',
			data: {f: 'json',
				features: JSON.stringify([edit])
			},
		})
		.done(function(e) {
			var result = e.addResults[0];
			if (result.success) {
				$.ajax({
					url: "php/mail.php",
					type: "GET",
					data: {
						name: $("#inputName").val(),
						email: $("#inputEmail").val(),
						type: $("option:selected", "#typeSelect").text(),
						feedback: $("#commentArea").val(),
						location: $("#location").text(),
						id: result.objectId
					}
				});
				$("#mapModal").modal("toggle");
				$("#inputName").val("");
				$("#inputEmail").val("");
				$("#confirmEmail").val("");
				$("#commentArea").val("");
				$("#typeSelect").prop("selectedIndex", 0);
				locMarkersP.clearLayers();
				locMarkersC.clearLayers();
				feedbackLayer.refresh();
			}

		});
	}

		$.validator.addMethod("radioActive", function(value, element) {
		    return $(".active", element).length > 0;
		}, "Selection required");

		$.validator.addMethod("confirmEmail", function (value, element) {
			return value === $("#inputEmail").val();
		}, "Email address does not match");

		$('form').validate({
			ignore: [],
			rules: {
				name: {
					required: true,
					maxlength: 50
				},
				email: {
					required: true,
					email: true,
					maxlength: 50
				},
				confirmEmail: {
					required: true,
					email: true,
					confirmEmail: true,
					maxlength: 50
				},
				address: {
					required: true,
					maxlength: 100
				},
				comment: {
					required: true,
					maxlength: 1000
				},
				owner: {
					radioActive: true
				}
			},
			submitHandler: submitForm,
			errorPlacement: placeErrors,
			success: removeErrors
		});


	function getFeedbackType (type) {
		var arr = $(types).filter(function () {
			return this.code === type;
		});
		return (arr.length > 0) ? arr[0].name : type;
	}

	function popupLinkClicked () {
		$("#popupModal .modal-title").text($(this).data('title'));
		$("#popupModal .modal-body").text($(this).data('full'));
		$("#popupModal").modal('show');
	}

	function buildPopup(feature) {
		var popup = $("<div></div>");
		var content = "",
			fullFeedback = "",
			fullResponse = "";

		popup.append("<strong>Category</strong> "+getFeedbackType(feature.properties.TYPE)+"<br/>");

		if (feature.properties.FEEDBACK.length > 200) {
			popup.append("<strong>Feedback </strong><span>"+feature.properties.FEEDBACK.substring(0,200)+"...</span>");
			var fbPopup = $('<a class="popup-link" href="javascript:void(0)" data-title="Feedback" data-full="'+feature.properties.FEEDBACK.replace(/"/g, '&quot;')+'"> View More</a>').appendTo(popup);
			fbPopup.click(popupLinkClicked);
			popup.append("</span><br/>");
		} else {
			popup.append("<strong>Feedback </strong><span>"+feature.properties.FEEDBACK+"<br/>");
		}

		if (feature.properties.CREATE_DATE) {
			var submitted = moment(new Date(feature.properties.CREATE_DATE)).format('MMMM Do YYYY, h:mm a');
			popup.append("<strong>Submitted</strong> "+submitted.toString()+"<br/>");
		}

		if (feature.properties.RESPONDED) {
			if (feature.properties.RESPONSE.length > 200) {
				popup.append("<strong>Response </strong><span>"+feature.properties.RESPONSE.substring(0,200)+"...</span>");
				var rePopup = $('<a class="popup-link" href="javascript:void(0)" data-title="Response" data-full="'+feature.properties.RESPONSE.replace(/"/g, '&quot;')+'"> View More</a>').appendTo(popup);
				rePopup.click(popupLinkClicked);
				popup.append("</span><br/>");
			} else {
				popup.append("<strong>Response </strong><span>"+feature.properties.RESPONSE+"<br/>");
			}
		}

		if (feature.properties.RESPONSE_DATE) {
			if (feature.properties.RESPONSE_DATE != feature.properties.CREATE_DATE){
				var responded = moment(new Date(feature.properties.RESPONSE_DATE)).format('MMMM Do YYYY, h:mm a');
				popup.append("<strong>Responded</strong> "+responded.toString());
			}
		}



		return popup;
	}


	function feedbackLayerLoaded (e) {
		$(e.metadata.fields).each(function (i, f) {
			if (f.name === "TYPE") {
				if (f.domain.type === "codedValue") {
					types = f.domain.codedValues;
					$(f.domain.codedValues).each(function (i, cv) {
						$("#typeSelect").append("<option value='"+cv.code+"'>"+cv.name+"</option>");
					});
				}
			}
		});
		//feedbackLayer.addTo(proposed)
	}

	$("#closeWarning").click(function () {
		$(".browser-warning").hide();
	});
	$(".glyphicon-question-sign").tooltip();
	$(".feedback").tooltip();
	current = L.map('currentMap', {minZoom: 10}).setView([35.81889, -78.64447], 11);
	proposed = L.map('proposedMap', {minZoom: 10}).setView([35.81889, -78.64447], 11);

	current.sync(proposed);
	proposed.sync(current);
	L.esri.basemapLayer("Topographic").addTo(current);
	L.esri.basemapLayer("Topographic").addTo(proposed);

	addMapClick();

	L.esri.dynamicMapLayer(config.parcels.url, {opacity: 0.20, layers: [0,1], position: 'back'}).addTo(current);
	L.esri.dynamicMapLayer(config.parcels.url, {opacity: 0.20, layers: [0,1], position: 'back'}).addTo(proposed);
	var zoning = L.esri.dynamicMapLayer(config.udoService.url, {opacity: 0.50, layers:[0]}).addTo(current);
	var udo = L.esri.dynamicMapLayer(config.udoService.url, {opacity: 0.50, layers: [1]}).addTo(proposed);
	var overlayCurrent = L.esri.dynamicMapLayer(config.overlays.url, {opacity: 1});//.addTo(current);
	var overlayProposed = L.esri.dynamicMapLayer(config.udoService.url, {opacity: 1, layers: [3,4,5,6,7,8,9,10,11,12,13,14,15]});//.addTo(proposed);
	locMarkersC = L.featureGroup().addTo(current);
	locMarkersP = L.featureGroup().addTo(proposed);
	var icons = [L.icon({
		iconUrl: 'img/marker-icon-red.png',
		iconSize: [25,41]
	}),L.icon({
		iconUrl: 'img/marker-icon-green.png',
		iconSize: [25,41]
	})];


		$('textarea').maxlength({
            alwaysShow: true,limitReachedClass: "label label-important"
        });

    var template = "<strong>Category</strong> {TYPE} <br/><strong>Feedback</strong> {FEEDBACK}";
		feedbackLayer = L.esri.clusteredFeatureLayer(config.feedbackLayer.url,{
		where: "DISPLAY = 1 OR DISPLAY IS NULL",
		cluster: new L.MarkerClusterGroup({
	        iconCreateFunction: function(cluster) {
	            var count = cluster.getChildCount();
	            var digits = (count+"").length;
	            return new L.DivIcon({
	              html: count,
	              className:"cluster digits-"+digits,
	              iconSize: null
	            });
	        }


		}),
        createMarker: function (geojson, latlng) {
          var responded = (geojson.properties.RESPONDED) ? geojson.properties.RESPONDED: 0;
          return L.marker(latlng, {
            icon: icons[responded]
          });
        },
		onEachMarker: function (feature, layer) {
			layer.bindPopup(buildPopup(feature)[0]);
    }})
		.on('metadata', feedbackLayerLoaded);

		L.control.layers({}, {'Zoning': zoning, 'Overlay Districts': overlayCurrent}).addTo(current);
		L.control.layers({}, {'Zoning': udo, 'Overlay Districts': overlayProposed, 'Feedback': feedbackLayer}).addTo(proposed);
		var lcP = L.control.locate().addTo(proposed);
		var lcC = L.control.locate().addTo(current);

		proposed.on("locationfound", function (location){
			lastAction = "click";
			lcP.stopLocate();
			var point = {x: location.latlng.lng, y: location.latlng.lat};
			_gaq.push(['_trackEvent', 'Search', 'Type', 'Geolocation']);
			getInfo(point);
			setMapView(point);
		});

		current.on("locationfound", function (location){
			lastAction = "click";
			lcC.stopLocate();
			var point = {x: location.latlng.lng, y: location.latlng.lat};
			_gaq.push(['_trackEvent', 'Search', 'Type','Geolocation']);
			getInfo(point);
			setMapView(point)
		});
		$.getJSON('json/zoning.json', function(data, textStatus) {
			json = data;
		});

		$(window).resize(function () {
			var mq = window.matchMedia("(max-width: 760px)");
			if (mq.matches && addressText) {
				$("#addressAlert").show();
			}
		});
});
