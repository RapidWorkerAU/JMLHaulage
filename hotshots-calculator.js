(function () {
  const pricing = window.HOTSHOTS_PRICING || {
    perHour: 300,
    perKm: 7.40,
    returnTripMultiplier: 2,
    returnTripHoursExtra: 2
  };

  const formatCurrency = (value) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 0,
      minimumFractionDigits: 0
    }).format(Math.round(value));

  const getElements = () => {
    return {
      pickup: document.querySelector("#pickup"),
      delivery: document.querySelector("#delivery"),
      email: document.querySelector("#estimateEmail"),
      distanceKm: document.querySelector("#distanceKm"),
      estimateStatus: document.querySelector("#estimateStatus, #minEstimate"),
      calcBtn: document.querySelector("#calcBtn"),
      restartBtn: document.querySelector("#restartBtn"),
      distanceRow: document.querySelector("#distanceRow"),
      estimateResult: document.querySelector("#estimateResult"),
      estimateAlert: document.querySelector("#estimateAlert"),
      estimateCard: document.querySelector("#estimateCard"),
      summaryFrom: document.querySelector("#summaryFrom"),
      summaryTo: document.querySelector("#summaryTo"),
      summaryDistance: document.querySelector("#summaryDistance"),
      summaryTime: document.querySelector("#summaryTime"),
      mapEl: document.getElementById("map") || document.querySelector(".map-canvas")
    };
  };

  const formatDuration = (seconds) => {
    const totalMinutes = Math.round(seconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours <= 0) {
      return minutes + " min";
    }

    if (minutes === 0) {
      return hours + " hr";
    }

    return hours + " hr " + minutes + " min";
  };

  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const EMAIL_PROMPT = "Check your email (and spam folder)";

  let map;
  let directionsService;
  let directionsRenderer;
  let autocompletePickup;
  let autocompleteDelivery;

  window.initMap = function () {
    const els = getElements();
    if (!els.mapEl) {
      return;
    }

    map = new google.maps.Map(els.mapEl, {
      center: { lat: -31.9523, lng: 115.8613 },
      zoom: 8
    });

    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
      map: map,
      suppressMarkers: false
    });

    if (els.pickup) {
      autocompletePickup = new google.maps.places.Autocomplete(els.pickup, {
        fields: ["formatted_address", "geometry", "name"]
      });
    }

    if (els.delivery) {
      autocompleteDelivery = new google.maps.places.Autocomplete(els.delivery, {
        fields: ["formatted_address", "geometry", "name"]
      });
    }

    wireCalculator();
  };

  const wireCalculator = () => {
    const els = getElements();
    if (!els.calcBtn) {
      return;
    }

    const setAlert = (message) => {
      if (!els.estimateAlert) return;
      els.estimateAlert.textContent = message;
    };

    const clearAlert = () => setAlert("");

    const setLoading = (isLoading) => {
      if (!els.calcBtn) return;
      els.calcBtn.disabled = isLoading;
      els.calcBtn.textContent = isLoading ? "Sending estimate..." : "Calculate estimate";
    };

    const resetSummary = () => {
      if (els.summaryFrom) els.summaryFrom.textContent = "-";
      if (els.summaryTo) els.summaryTo.textContent = "-";
      if (els.summaryDistance) els.summaryDistance.textContent = "-";
      if (els.summaryTime) els.summaryTime.textContent = "-";
      if (els.estimateStatus) els.estimateStatus.textContent = EMAIL_PROMPT;
    };

    const hideDistanceRow = () => {
      if (els.distanceRow) {
        els.distanceRow.classList.add("is-hidden");
      }
    };

    const showDistanceRow = () => {
      if (els.distanceRow) {
        els.distanceRow.classList.remove("is-hidden");
      }
    };

    const hideResult = () => {
      if (els.estimateCard) {
        els.estimateCard.classList.remove("is-flipped");
      }
    };

    const showResult = () => {
      if (els.estimateCard) {
        els.estimateCard.classList.add("is-flipped");
      }
    };

    hideDistanceRow();
    resetSummary();
    hideResult();

    els.calcBtn.addEventListener("click", function () {
      const pickup = (els.pickup && els.pickup.value || "").trim();
      const delivery = (els.delivery && els.delivery.value || "").trim();
      const email = (els.email && els.email.value || "").trim();

      if (!pickup || !delivery) {
        setAlert("Please enter both pickup and delivery locations.");
        return;
      }

      if (!email) {
        setAlert("Please enter your email to receive your estimate.");
        return;
      }

      if ((els.email && !els.email.checkValidity()) || !isValidEmail(email)) {
        setAlert("Please enter a valid email address.");
        return;
      }

      clearAlert();
      setLoading(true);

      directionsService.route(
        {
          origin: pickup,
          destination: delivery,
          travelMode: google.maps.TravelMode.DRIVING
        },
        async function (result, status) {
          if (status !== "OK" || !result.routes || !result.routes[0] || !result.routes[0].legs || !result.routes[0].legs[0]) {
            setAlert("Route not available - call for a formal quote.");
            hideResult();
            setLoading(false);
            return;
          }

          directionsRenderer.setDirections(result);

          const leg = result.routes[0].legs[0];
          const distanceMeters = leg.distance && leg.distance.value ? leg.distance.value : 0;
          const durationSeconds = leg.duration && leg.duration.value ? leg.duration.value : 0;

          const oneWayKm = distanceMeters / 1000;
          const oneWayHours = durationSeconds / 3600;

          if (els.distanceKm) {
            els.distanceKm.value = oneWayKm.toFixed(1);
          }

          if (els.summaryFrom) {
            els.summaryFrom.textContent = leg.start_address || pickup;
          }

          if (els.summaryTo) {
            els.summaryTo.textContent = leg.end_address || delivery;
          }

          if (els.summaryDistance) {
            els.summaryDistance.textContent = oneWayKm.toFixed(1) + " km";
          }

          if (els.summaryTime) {
            els.summaryTime.textContent = formatDuration(durationSeconds);
          }

          const billableKm = oneWayKm * pricing.returnTripMultiplier;
          const billableHours = oneWayHours * pricing.returnTripMultiplier + pricing.returnTripHoursExtra;

          const kmCost = billableKm * pricing.perKm;
          const hourCost = billableHours * pricing.perHour;
          const minimumEstimate = Math.min(kmCost, hourCost);
          const estimateLabel = formatCurrency(minimumEstimate);

          if (els.estimateStatus) {
            els.estimateStatus.textContent = EMAIL_PROMPT;
          }

          try {
            const isFilePreview = window.location && window.location.protocol === "file:";
            if (isFilePreview) {
              showResult();
              showDistanceRow();
              setAlert("Email sending is disabled when opened from a file. Serve the site over http(s) to email the estimate.");
              return;
            }

            const response = await fetch("/.netlify/functions/send-estimate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: email,
                pickup: leg.start_address || pickup,
                delivery: leg.end_address || delivery,
                distanceKm: oneWayKm.toFixed(1),
                duration: formatDuration(durationSeconds),
                estimate: estimateLabel
              })
            });

            if (!response.ok) {
              throw new Error("Email send failed.");
            }

            showResult();
            showDistanceRow();
          } catch (error) {
            showResult();
            showDistanceRow();
            setAlert("We could not email the estimate. Please try again or call for a formal quote.");
          } finally {
            setLoading(false);
          }
        }
      );
    });

    if (els.restartBtn) {
      els.restartBtn.addEventListener("click", function () {
        if (els.pickup) els.pickup.value = "";
        if (els.delivery) els.delivery.value = "";
        if (els.email) els.email.value = "";
        if (els.distanceKm) els.distanceKm.value = "";
        if (directionsRenderer) {
          directionsRenderer.set("directions", null);
        }
        resetSummary();
        hideDistanceRow();
        hideResult();
        clearAlert();
      });
    }
  };
})();
