var util = require('util');
var _ = require('lodash');

// var validator = require('validator');
// var validator = require('validate.js');

var validate = function(validation){
  // validation:
  // {
  //   'field': {
  //     validationFunc: validatonArgs,
  //     message: "Field %(field) has invalid value %(value). Expected %(validator) with %(expected)"
  //   },
  //   'x': {isInt: true, isRequired: true}
  // }

  var custom_validators = {
    // value is an array, value is a single value or array
    isIn: function(value, target){
      if(!Array.isArray(value)){
        value = [value];
      }

      if(_.difference(value, target).length > 0){
        return false
      }

      return true;
    },

    keysIn: function(value, target){
      var keys = Object.keys(value);

      return custom_validators.isIn(keys, target);
    },

    hasKeys: function(value, target){
      var keys = Object.keys(value);

      return custom_validators.isIn(target, keys);
    }
  }

  return function(input){
    var have_errors = false;
    var errors = [];

    var default_template = "%(field) validation failed, expected %(value) %(validator) %(expected)";

    // content: {field, value, validator, expected}
    function formatMessage(template, content){
      template = template || default_template;

      var replacements = {
        "%(field)": 'field',
        "%(value)": 'value',
        "%(validator)": 'validator',
        "%(expected)": 'expected'
      }

      _.forOwn(replacements, function(key, variable){
        if( content[key] ){
          var value = content[key];
          if(_.isObject(value)){
            value = JSON.stringify(value);
          }
          template = template.replace(variable, value);
        }
      });

      return template;
    }

    function addError(field, error){
      have_errors = true;
      errors.push({field: field, message: error});
    }


    _.forOwn(input, function(value, key) {
      // console.log("[input] key:", key, "value:", value);
      _.forOwn(validation, function(validatorProps, fieldName) {
        if(fieldName !== key) return;

        // console.log("\t[validation] fieldName:", fieldName, "validatorProps:", validatorProps);
        _.forOwn(validatorProps, function(expectedValue, validatorName) {
          // console.log("\t\t[validatorProps] validatorName:", validatorName, "expected:", expectedValue);

          // skip 'message'
          if(validatorName === 'message') return;

          var validatorFn = custom_validators[validatorName];

          if(!validatorFn){
            return addError(key, util.format("Validator doesn't exist: %s", validatorName));
          }

          // console.log("checking", fieldName, "value", value, "against", expectedValue);
          var valid = validatorFn(value, expectedValue);

          if(!valid){
            // TODO: move message from validatorProps to validatorFn/object
            addError(key, formatMessage(validatorProps.message, {
              field: fieldName,
              value: value,
              expected: expectedValue,
              validator: validatorName
            }));
          }
        });
      });
    });

    return have_errors && errors;
  }
}

module.exports = validate;