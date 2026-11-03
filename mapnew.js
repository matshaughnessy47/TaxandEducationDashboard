import Map from "https://js.arcgis.com/5.1/@arcgis/core/Map.js";
import MapView from "https://js.arcgis.com/5.1/@arcgis/core/views/MapView.js";
import FeatureLayer from "https://js.arcgis.com/5.1/@arcgis/core/layers/FeatureLayer.js";
import Legend from "https://js.arcgis.com/5.1/@arcgis/core/widgets/Legend.js";
import Graphic from "https://js.arcgis.com/5.1/@arcgis/core/Graphic.js";

window.addEventListener("DOMContentLoaded", () => {
  const statesLayer = new FeatureLayer({
    url: "https://services.arcgis.com/P3ePLMYs2RVChkJx/ArcGIS/rest/services/USA_States_Generalized_Boundaries/FeatureServer/0",
    title: "US States",
    popupTemplate: {
      // autocast as esri/PopupTemplate
      title: "{STATE_NAME }",
      content:
        "Population: {POPULATION }  "
    },
    opacity: 0.9
  });

  const map = new Map({
    basemap: "gray-vector",
    layers: []
  });

  const view = new MapView({
    container: "viewDiv",
    map: map,
    center: [-100.3487846, 39.58907],
    zoom: 3
  });

  const legend = new Legend({
    view: view
  });

  view.ui.add(legend, "bottom-left");
  var $table = $('#table')
  // The table is initialized in index.html before this module loads.
  // flags to track async data readiness
  //!! create a new flag variable for your added new data like following two datasets, set it  to true once that data finishes loading

  let statesLoaded = false;
  let medianLoaded = false;
  let educationLoaded = false;
  let educationMapLayer = null;

  const maybeCreateEducationLayer = function () {
    if (!educationLoaded || !statesLoaded || educationMapLayer) return;

    const graphics = [];
    Object.entries(stateObj).forEach(function ([key, value]) {
      if (value.educationAttainment === null || value.educationAttainment === "") return;
      const educationAttainment = Number(value.educationAttainment);
      if (!value.geometry || !Number.isFinite(educationAttainment)) return;

      graphics.push(new Graphic({
        geometry: value.geometry,
        attributes: {
          ObjectId: graphics.length,
          State_Abbr: value.abb,
          State_Name: key.replace("_", " "),
          EducationAttainment: educationAttainment
        }
      }));
    });

    if (!graphics.length) {
      console.warn("No state education data with geometry is available for the map.");
      return;
    }

    const educationRenderer = {
      type: "class-breaks",
      field: "EducationAttainment",
      legendOptions: {
        title: "Bachelor's Degree or Higher (%)"
      },
      defaultSymbol: {
        type: "simple-fill",
        color: "#d9d9d9",
        style: "backward-diagonal",
        outline: {
          width: 0.5,
          color: [80, 80, 80, 0.6]
        }
      },
      defaultLabel: "No data",
      classBreakInfos: [
        {
          minValue: 0,
          maxValue: 20,
          symbol: { type: "simple-fill", color: "#ffffcc", outline: { color: "#ffffff", width: 0.5 } },
          label: "0–20%"
        },
        {
          minValue: 20,
          maxValue: 25,
          symbol: { type: "simple-fill", color: "#c2e699", outline: { color: "#ffffff", width: 0.5 } },
          label: "20–25%"
        },
        {
          minValue: 25,
          maxValue: 30,
          symbol: { type: "simple-fill", color: "#78c679", outline: { color: "#ffffff", width: 0.5 } },
          label: "25–30%"
        },
        {
          minValue: 30,
          maxValue: 35,
          symbol: { type: "simple-fill", color: "#31a354", outline: { color: "#ffffff", width: 0.5 } },
          label: "30–35%"
        },
        {
          minValue: 35,
          maxValue: 100,
          symbol: { type: "simple-fill", color: "#006837", outline: { color: "#ffffff", width: 0.5 } },
          label: "35% and higher"
        }
      ]
    };

    educationMapLayer = new FeatureLayer({
      source: graphics,
      objectIdField: "ObjectId",
      geometryType: "polygon",
      spatialReference: graphics[0].geometry.spatialReference,
      title: "Bachelor's+ Education (%)",
      fields: [
        { name: "ObjectId", type: "oid" },
        { name: "State_Abbr", type: "string" },
        { name: "State_Name", type: "string" },
        { name: "EducationAttainment", type: "double" }
      ],
      popupTemplate: {
        title: "{State_Name}",
        content: "Adults with a bachelor's degree or higher: {EducationAttainment}%"
      },
      renderer: educationRenderer,
      visible: true
    });
    map.add(educationMapLayer);
  };

  // disable submit until required data is loaded
  const submitBtn = document.querySelector('form button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;
  // fallback: if data hasn't loaded after 10s, enable submit anyway
  setTimeout(() => {
    if (submitBtn && submitBtn.disabled) {
      submitBtn.disabled = false;
      console.warn('Submit enabled after timeout — some data may be missing.');
    }
  }, 10000);

  // function to load state geometries into stateObj
  var loadStates = function () {
    var table = document.getElementById("myTable");

    //stateObj.js defines a global variable and it is executed before referencing mapnew.js in index.html
    // Create an empty <tr> element and add it to the 1st position of the table:
    Object.entries(stateObj).sort().forEach(([key, value], index) => {
      // console.log(`${index}: ${key} = ${value}`);

      $table.bootstrapTable('insertRow', {
        index: index,
        row: {
          state: key.replace("_", " "),

        }

      })

    });
    let query = statesLayer.createQuery();
    //   query.where = "1==1"
    query.returnGeometry = true;
    query.outFields = ["STATE_ABBR", "STATE_NAME"];

    statesLayer.queryFeatures(query)
      .then(function (response) {
        console.log(response)
        response.features.forEach(function (feature, ind) {
          var abbr = feature.attributes.STATE_ABBR;
          if (abbr && abbr !== "DC") {
            // find matching key in stateObj by abbreviation (more robust than matching by name)
            var matchKey = Object.keys(stateObj).find(k => {
              return stateObj[k] && stateObj[k].abb && stateObj[k].abb.toUpperCase() === abbr.toUpperCase();
            });
            if (matchKey) {
              stateObj[matchKey]['geometry'] = feature.geometry;
            } else {
              console.warn('loadStates: no matching stateObj entry for', abbr, feature.attributes.STATE_NAME);
            }
          }

        })
        console.log('loadStates: geometry loaded for states');
        statesLoaded = true;
        maybeCreateEducationLayer();
        //!!if you have a new dataset, you also need to check if all are loaded before enabling submit in the following if statement.
        if (statesLoaded && medianLoaded) {
          if (submitBtn) submitBtn.disabled = false;
          console.log('Tax data loaded — submit enabled');
        }
        console.log(stateObj)
        //!! If you have a new dataset, you also need to update the condition if below to include your new flag variable.
      }).catch(function (err) {
        console.error('loadStates failed:', err);
        // avoid leaving submit permanently disabled
        statesLoaded = true;
        if (medianLoaded && submitBtn) submitBtn.disabled = false;
      });



  }
  loadStates()
  ///this is where you'll query an additional service to add more data to you mapping dashboard
  ///here are some examples
  //this example is from the URL below
  //https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/ACS_Median_Income_by_Race_and_Age_Selp_Emp_Boundaries/FeatureServer
  //however, there are a whole bunch of state level datasets you can use here:
  // repository for american community survey services: https://services.arcgis.com/P3ePLMYs2RVChkJx/ArcGIS/rest/services 


  //Create a feature layer from your URL, this is the url for state layer.
  var medianIncomeUrl = "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/ACS_Median_Income_by_Race_and_Age_Selp_Emp_Boundaries/FeatureServer/0"
  const medianIncomeLayer = new FeatureLayer({
    url: medianIncomeUrl,
    title: "Median Income",
  });

  //Make function to execture query
  var loadAdditionalData = function () {
    ////Create a new query object and give it the correct properties for what you want
    let additionalQuery = medianIncomeLayer.createQuery();
    additionalQuery.returnGeometry = false;
    additionalQuery.outFields = "*"
    ////execute query on your new layer
    medianIncomeLayer.queryFeatures(additionalQuery).then(function (r) {
      console.log(r)
      r.features.forEach(function (feature) {
        // prefer matching by postal abbreviation (STUSPS)
        var abbr = feature.attributes && feature.attributes['STUSPS'];
        if (!abbr || abbr === "DC") return;

        // find matching key in stateObj by abb (case-insensitive)
        var matchKey = Object.keys(stateObj).find(k => {
          return stateObj[k] && stateObj[k].abb && stateObj[k].abb.toUpperCase() === abbr.toUpperCase();
        });

        if (!matchKey) {
          console.warn('loadAdditionalData: no matching stateObj entry for', abbr, feature.attributes.NAME);
          return;
        }

        // the median income field sometimes differs; try the expected field, else inspect attributes
        var income = null;
        if ('B19049_001E' in feature.attributes) {
          income = feature.attributes['B19049_001E'];
        } else if ('MEDIAN_INCOME' in feature.attributes) { // example fallback
          income = feature.attributes['MEDIAN_INCOME'];
        } else {
          // if the expected field isn't present, log available keys to pick the correct one
          console.warn('loadAdditionalData: median income field not found for', abbr, 'attributes keys:', Object.keys(feature.attributes));
        }

        // set medianIncome (may be null if no field found)
        stateObj[matchKey]['medianIncome'] = income;
      });
      console.log('loadAdditionalData: median income loaded');
      medianLoaded = true;
      if (statesLoaded && medianLoaded) {
        if (submitBtn) submitBtn.disabled = false;
        console.log('All data loaded — submit enabled');
      }
    }).catch(function (err) {
      console.error('loadAdditionalData failed:', err);
      medianLoaded = true;
      if (statesLoaded && medianLoaded) {
        if (submitBtn) submitBtn.disabled = false;
      } else {
        if (submitBtn) submitBtn.disabled = false;
      }
    })
  }

  loadAdditionalData()

  const educationLayer = new FeatureLayer({
    url: "https://services.arcgis.com/P3ePLMYs2RVChkJx/ArcGIS/rest/services/ACS_10_14_Educational_Attainment_Boundaries/FeatureServer/0",
    title: "Educational Attainment"
  });

  const loadEducationData = function () {
    const query = educationLayer.createQuery();
    query.returnGeometry = false;
    query.outFields = ["STUSPS", "B15002_calc_pctGEBAE"];

    educationLayer.queryFeatures(query)
      .then(function (response) {
        response.features.forEach(function (feature) {
          const attributes = feature.attributes;
          const abbr = attributes && attributes.STUSPS;
          if (!abbr || abbr.toUpperCase() === "DC") return;

          const matchKey = Object.keys(stateObj).find(function (key) {
            return stateObj[key] && stateObj[key].abb &&
              stateObj[key].abb.toUpperCase() === abbr.toUpperCase();
          });

          if (!matchKey) {
            console.warn('loadEducationData: no matching stateObj entry for', abbr);
            return;
          }

          const rawPercentage = attributes.B15002_calc_pctGEBAE;
          const percentage = Number(rawPercentage);
          stateObj[matchKey].educationAttainment =
            rawPercentage !== null && rawPercentage !== "" && Number.isFinite(percentage)
              ? percentage.toFixed(1)
              : null;
        });

        Object.entries(stateObj).forEach(function ([key, value]) {
          const stateName = key.replace("_", " ");
          $table.bootstrapTable('updateByUniqueId', {
            id: stateName,
            row: {
              educationAttainment: value.educationAttainment || "N/A"
            }
          });
        });
        educationLoaded = true;
        maybeCreateEducationLayer();
        console.log('loadEducationData: education attainment loaded');
      })
      .catch(function (err) {
        console.error('loadEducationData failed:', err);
      });
  };

  loadEducationData();


  // helper function to find tax rate for given income
  const between = (x, min, max) => {
    return x >= min && x <= max;
  }
  const getRate = function (arr, inc) {
    if (!arr || !Array.isArray(arr.range) || !Array.isArray(arr.rate)) {
      return [0, 0];
    }
    let taxRate = 0;
    for (var i = 0; i < arr.range.length; i++) {
      if (between(inc, arr.range[i][0], arr.range[i][1])) {
        taxRate = arr.rate[i];
        return [taxRate, arr.range[i][0]];
      }
    }
    // fallback: return last rate if not matched
    return [arr.rate[arr.rate.length - 1] || 0, arr.range[arr.range.length - 1] ? arr.range[arr.range.length - 1][0] : 0];
  }
  const formElement = document.querySelector('form')
  formElement.addEventListener("submit", (e) => {
    // on form submission, prevent default
    e.preventDefault();
    $table.bootstrapTable('removeAll');

    // parse numeric inputs and chosen filing status using the declared formElement
    var income = Number(formElement.querySelector('input[name="income"]').value.replaceAll(",", "")) || 0;
    var married = formElement.querySelector('input[name="marriedRadios"]:checked').value === 'married';
    var dependents = Number($('#dependents').val()) || 0;
    console.log('Filing status:', married ? 'Married' : 'Single', 'dependents:', dependents, 'income:', income);
    if (income > 100000000) {
      alert("Sorry, you make too much money for this tool to be useful")
    }
    else {
      Object.entries(stateObj).forEach(([key, value], index) => {
        try {
          if (value.notax == true) {
            $table.bootstrapTable('insertRow', {
              index: index,
              row: {
                state: key.replace("_", " "),
                incomeAfterTaxes: income.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","),
                grossDifference: 0,
                percentDifference: 0,
                ////Add new row to states with no tax///
                medianIncome: value.medianIncome,
                educationAttainment: value.educationAttainment || "N/A"
              }
            })
          }
          else {
            // declare locals to avoid leaking to outer scope
            let rateArr, rate = 0, bracket = 0, incomeWithExemptions = 0, taxBeforeCredits = 0, taxAfterCreditsRaw = 0, totalTax = 0, totalExemptions = 0, totalCredits = 0;

            if (married == true) {
              // married filers should use married_brackets and married SD/exemptions
              rateArr = getRate(value.married_brackets, income)
              rate = rateArr[0]
              bracket = rateArr[1]
              incomeWithExemptions = income - (value.SD_married || 0) - (value.married_exemption || 0) - ((value.dependent_exemption || 0) * dependents)
              taxBeforeCredits = incomeWithExemptions * rate
              taxAfterCreditsRaw = taxBeforeCredits - (value.married_credit || 0) - ((value.dependent_credit || 0) * dependents)
              totalTax = taxAfterCreditsRaw > 0 ? Math.trunc(taxAfterCreditsRaw) : 0
              totalExemptions = (value.SD_married || 0) + ((value.dependent_exemption || 0) * dependents) + (value.married_exemption || 0)
              totalCredits = ((value.dependent_credit || 0) * dependents) + (value.married_credit || 0)
            }
            else {
              // single filers use single_brackets and single SD/exemptions
              rateArr = getRate(value.single_brackets, income)
              rate = rateArr[0]
              bracket = rateArr[1]
              incomeWithExemptions = income - (value.SD_single || 0) - (value.personal_exemption || 0) - ((value.dependent_exemption || 0) * dependents)
              taxBeforeCredits = incomeWithExemptions * rate
              taxAfterCreditsRaw = taxBeforeCredits - (value.personal_credit || 0) - ((value.dependent_credit || 0) * dependents)
              totalTax = taxAfterCreditsRaw > 0 ? Math.trunc(taxAfterCreditsRaw) : 0
              totalExemptions = (value.SD_single || 0) + ((value.dependent_exemption || 0) * dependents) + (value.personal_exemption || 0)
              totalCredits = ((value.dependent_credit || 0) * dependents) + (value.personal_credit || 0)
            }

            // safe percent calculation
            let percent = (income > 0) ? ((totalTax / income) * 100) : 0;

            $table.bootstrapTable('insertRow', {
              index: index,
              row: {
                state: key.replace("_", " "),
                bracket: (rate * 100).toFixed(2),
                incomeAfterTaxes: Math.trunc((income - totalTax)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","),
                grossDifference: Math.trunc(totalTax).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","),
                percentDifference: percent.toFixed(2),
                totalExemptions: Math.trunc(totalExemptions).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","),
                totalCredits: Math.trunc(totalCredits).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","),
                ///////////Add new row here too //////////                            
                medianIncome: value.medianIncome,
                educationAttainment: value.educationAttainment || "N/A"

              }
            })
            value['incomeBeforeTaxes'] = Math.trunc(income)
            value['incomeAfterTaxes'] = Math.trunc((income - totalTax))
            value['grossDifference'] = Math.trunc(totalTax)
            value['percentDifference'] = percent
            value['bracket'] = (bracket !== undefined && bracket !== null) ? bracket.toString().replace("[", "").replace("]", "") : "0"

            $("th[data-field='percentDifference'] .sortable").click();
          }
        }
        catch (err) {
          console.error('Error processing state', key, err);
        }
      })
      console.log(stateObj)
    }
  });
});