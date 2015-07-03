(function ($, undefined) {
	'use strict';
	var
		// Plugin name.
		name = 'validate',

		// Writable fields.
		writable = 'input[type=color]:not(:disabled),input[type=date]:not(:disabled),input[type=datetime]:not(:disabled),input[type=datetime-local]:not(:disabled),input[type=email]:not(:disabled),input[type=file]:not(:disabled),input[type=hidden]:not(:disabled),input[type=month]:not(:disabled),input[type=number]:not(:disabled),input[type=password]:not(:disabled),input[type=range]:not(:disabled),input[type=search]:not(:disabled),input[type=tel]:not(:disabled),input[type=text]:not(:disabled),input[type=time]:not(:disabled),input[type=url]:not(:disabled),input[type=week]:not(:disabled),textarea:not(:disabled),select:not(:disabled),input:not([type])',

		// Checkable fields.
		checkable = 'input[type=checkbox]:not(:disabled),input[type=radio]:not(:disabled)',

		// All field types.
		fieldTypes = checkable + ',' + writable,
		errorIsNotAForm = 'This is not a form.',
		emptyArray = [],
		isFunction = $.isFunction,

		// Default properties.
		defaults = {
			events: emptyArray,
			filter: '*',
			ajax: false,
			send: false,
			selectInvalid: true,
			scroll: true,
			clearInvalid: false,
			conditional: {},
			prepare: {},
			description: {}
		},

		// A function to get a boolean value.
		getBoolean = function (value) {
			return (/^(true|)$/).test(value);
		},

		// A function to get an array.
		getArray = function (value) {
			return typeof value == 'string' ? value.split(/[\s\uFEFF\xA0]+/) : ($.isArray(value) ? value : []);
		},

		// Default validations.
		validate = {},

		// Attribute hooks.
		attributes = {
			chars: function (value) {
				return typeof value == 'string' ? new RegExp('[' + value.replace(/([\[\]])/g, '\\$1') + ']') : /./;
			},
			conditional: function (value) {
				return isFunction(value) ? value : getArray(value);
			},
			confirm: function (value) {
				return typeof value == 'string' ? $(fieldTypes).filter('#' + value).val() || '' : undefined;
			},
			ignorecase: function (value) {
				return getBoolean(value) ? 'i' : undefined;
			},
			mask: function (value) {
				return typeof value == 'string' ? value : undefined;
			},
			maxlength: function (value) {
				return Math.round(value) || Infinity;
			},
			minlength: function (value) {
				return Math.round(value) || 0;
			},
			pattern: function (value) {
				return (/^(regexp|string)$/).test($.type(value)) ? value : /(?:)/;
			},
			prepare: function (value) {
				return isFunction(value) ? value : getArray(value);
			}
		},

		// A function to get an attribute.
		getFieldAttribute = function (target, attribute) {
			target = $(target);
			var
				response = target.data(attribute);
			if (response === undefined && /^(trim|required|m(in|ax)length|prepare|conditional|ignorecase|validate|description|chars)$/.test(attribute)) {
				var
					parent = target.parents('*').filter(function () {
						return $(this).data(attribute) !== undefined;
					}).filter(':first');
				if (parent.length > 0) response = parent.data(attribute);
			}
			if (response === undefined && typeof target.data('validate') == 'string') response = (validate[target.data('validate')] || {})[attribute];
			if (isFunction(attributes[attribute])) return attributes[attribute].call(target, response);
			return response;
		},

		// A function to return events with namespaces.
		namespace = function (events) {
			return events.replace(/(\s|$)/g, '.' + name + '$1');
		},

		// A function to validate a field.
		validateField = function (event, bool) {
			var
				field = $(this),
				form = $(field.prop('form')),
				options = form.data(name),
				response = {
					valid: true,
					status: {
						required: true,
						minlength: true,
						maxlength: true,
						pattern: true,
						confirm: true,
						conditional: true
					}
				},
				minlength = getFieldAttribute(field, 'minlength'),
				maxlength = getFieldAttribute(field, 'maxlength'),
				pattern = getFieldAttribute(field, 'pattern'),
				prepare = getFieldAttribute(field, 'prepare'),
				conditional = getFieldAttribute(field, 'conditional'),
				mask = getFieldAttribute(field, 'mask'),
				value = field.val() || '',
				filled = false;

			if (getBoolean(getFieldAttribute(field, 'trim')))
				value = $.trim(value);

			if (isFunction(options.prepareAll))
				value = String(options.prepareAll.call(field, value));

			if (isFunction(prepare)) {
				value = String(prepare.call(field, value));
			}
			else if (prepare.length > 0)
				for (var currentPrepare = 0, prepareLength = prepare.length; currentPrepare < prepareLength; currentPrepare++)
					if (isFunction(options.prepare[prepare[currentPrepare]]))
						value = String(options.prepare[prepare[currentPrepare]].call(field, value));

			pattern = new RegExp($.type(pattern) == 'regexp' ? pattern.source : pattern, getFieldAttribute(field, 'ignorecase'));

			if (field.is(writable)) {
				filled = value.length > 0;
				response.status.minlength = value.length >= minlength;
				response.status.maxlength = value.length <= maxlength;
			}
			else if (field.prop('name')) {
				var checked = $('[name="' + field.prop('name') + '"]:checked');
				filled = checked.length > 0;
				response.status.minlength = checked.length >= minlength;
				response.status.maxlength = checked.length <= maxlength;
			}

			if (getBoolean(getFieldAttribute(field, 'required'))) {
				response.status.required = filled;
				response.status.pattern = pattern.test(value);
			}
			else if (filled)
				response.status.pattern = pattern.test(value);

			if (!bool && event && event.type != 'keyup' && response.status.pattern && mask !== undefined) {
				var
					parts = value.match(pattern) || emptyArray,
					newValue = mask;

				for (var currentPart = 0, partLength = parts.length; currentPart < partLength; currentPart++)
					newValue = newValue.replace(new RegExp('(^|[^\\\\])\\$\\{' + currentPart + '(?::`([^`]*)`)?\\}'), parts[currentPart] ? '$1' + parts[currentPart].replace(/\$/g, '$$') : '$1$2');

				newValue = newValue.replace(/(?:^|[^\\])\$\{\d+(?::`([^`]*)`)?\}/g, '$1');

				if (pattern.test(newValue))
					field.val(newValue);
			}

			if (isFunction(conditional)) {
				response.status.conditional = !!conditional.call(field, value);
			}
			else if (conditional.length > 0) {
				for (var currentConditional = 0, conditionalLength = conditional.length; currentConditional < conditionalLength; currentConditional++) {
					var conditionalName = conditional[currentConditional];

					if (isFunction(options.conditional[conditionalName]))
						response.status.conditional = !!options.conditional[conditionalName].call(field, value);
				}
			}

			if (getFieldAttribute(field, 'confirm') !== undefined)
				response.status.confirm = getFieldAttribute(field, 'confirm') === value;

			for (var currentStatus in response.status) {
				if (!response.status[currentStatus]) {
					response.valid = false;
					break;
				}
			}

			var
				target = field.prop('id').length > 0 ? $('[data-describe="' + field.prop('id') + '"]') : emptyArray,
				description = options.description || {},
				custom = description.custom || {};

			if (target.length) {
				$.extend(description, custom[getFieldAttribute(field, 'description')]);
				status.message = description[currentStatus];
				status.message = String(isFunction(status.message) ? status.message.call(field, value) : status.message);
				target.html(status.message);
			}



			if (!bool) {
				field.attr('aria-invalid', !response.valid);
				if (response.valid) {
					if (isFunction(options.eachValid)) options.eachValid.call(field, value, response);
					field.triggerHandler('valid');
				}
				else {
					if (options.clearInvalid)
						field.val('');

					if (isFunction(options.eachInvalid))
						options.eachInvalid.call(field, value, response);

					field.triggerHandler('invalid');
				}
				if (isFunction(options.eachField))
					options.eachField.call(field, value, response);

				field.triggerHandler('validated');
			}

			// Selectize.js Component
			if (jQuery(field).parent().parent().hasClass("selectize-control validate")) {
				if (jQuery(field).parent().parent().prev().attr("aria-invalid") == "false")
					jQuery(field).parent().removeClass("invalid").addClass("valid");
				else {
					jQuery(field).parent().removeClass("valid").addClass("invalid");
					jQuery(field).focus();
				}
			}
			
			// MaterializeCSS Select Component
			if (jQuery(field).hasClass("validate initialized") && jQuery(field).prev().prev().hasClass("select-dropdown")) {
				if (jQuery(field).attr("aria-invalid") == "false") {
					jQuery(field).prev().prev().removeClass("invalid").addClass("valid");
				}
				else {
					jQuery(field).prev().prev().removeClass("valid").addClass("invalid");
					jQuery(field).prev().prev().focus();
				}
			}

			if(!bool)
				return response;
			else
				return response.valid;
		},
		// A function to validate a form.
		validateForm = function (event, bool) {
			if (!event) event = new Event('validate');
			var
				form = $(this),
				options = form.data(name),
				fields = form.find(fieldTypes),
				valid = true,
				first = true;
			if (form.prop('id').length > 0)
				fields = fields.add($(fieldTypes).filter('[form="' + form.prop('id') + '"]'));
			fields.filter(options.filter).each(function () {
				if (!(bool ? validateField.call(this, event, bool) : validateField.call(this, event).valid)) {
					valid = false;
					var
						field = $(this);
					if (first) {
						if (!bool) {
							if (options.selectInvalid) field.trigger('select');
							if (options.scroll && field.is(':visible')) {
								var
									top = Math.floor((field.offset().top + (field.height() / 2)) - ($(window).height() / 2));
								top = top < 0 ? 0 : top;
								if ($(window).scrollTop() !== top) {
									$('body,html').animate({
										scrollTop: top
									}, $.extend({}, options.scroll));
								}
							}
						}
						first = false;
					}
				}
			});
			if (bool) return valid;
			if (valid) {
				if (!options.send || options.ajax) event.preventDefault();
				var
					ajaxResponse = options.ajax ? $.ajax($.extend({
						url: form.prop('action'),
						type: form.prop('method'),
						data: form.serialize()
					}, options.ajax)) : undefined;
				if (isFunction(options.valid)) options.valid.call(form, ajaxResponse);
				form.triggerHandler('valid', [ajaxResponse]);
			} else {
				event.preventDefault();
				event.stopImmediatePropagation();
				if (isFunction(options.invalid)) options.invalid.call(form);
				form.triggerHandler('invalid');
			}
			if (isFunction(options.validated)) options.validated.call(form);
			form.triggerHandler('validated');
		},
		// A function to extend an object.
		extend = function (target, index, value) {
			if (typeof index == 'string') {
				if (value !== undefined) {
					target[index] = value;
				} else return target[index];
			} else if ($.isPlainObject(index)) return $.extend(target, index);
			return target;
		},
		plugin = {
			init: function () {
				var
					element = $(this);
				if (element.is('form')) {
					var
						options = element.data(name),
						fields = element.find(fieldTypes);
					if (element.prop('id').length > 0) fields = fields.add($(fieldTypes).filter('[form="' + element.prop('id') + '"]'));
					element.on(namespace('submit'), function (event) {
						validateForm.call(this, event);
					});
					fields.filter(options.filter).on(namespace('keyup blur change'), function (event) {
						if ($.inArray(event.type, getArray(options.events)) > -1) validateField.call(this, event);
					}).on(namespace('keypress'), function (event) {
						var
							keyCodeChar = String.fromCharCode(event.keyCode);
						if (!getFieldAttribute(this, 'chars').test(keyCodeChar) && keyCodeChar !== '') {
							event.preventDefault();
							event.stopImmediatePropagation();
						}
					});
				} else $.error(errorIsNotAForm);
			},
			destroy: function () {
				var
					form = $(this);
				if (form.is('form')) {
					var
						fields = form.find(fieldTypes);
					if (form.prop('id').length > 0) fields = fields.add($(fieldTypes).filter('[form="' + form.prop('id') + '"]'));
					form.add(fields).off('.' + name).removeData(name);
					return form;
				} else $.error(errorIsNotAForm);
			},
			isvalid: function () {
				var
					valid = true;
				$(this).each(function () {
					var
						element = $(this);
					if (element.is('form')) {
						if (!validateForm.call(element, null, true)) {
							valid = false;
							return false;
						}
					} else if (element.is(fieldTypes)) {
						if (!validateField.call(element, null, true)) {
							valid = false;
							return false;
						}
					}
				});
				return valid;
			},
			trigger: function () {
				return $(this).each(function () {
					if ($(this).is('form')) {
						validateForm.call(this, null);
					} else if ($(this).is(fieldTypes)) validateField.call(this, null);
				});
			},
			option: function (index, value) {
				var
					data = $(this).data(name),
					response = extend(data, index, value);
				return value !== undefined ? $(this).data(name, data) : response;
			}
		};

		$.fn[name] = function (options) {
			return isFunction(plugin[options]) ? plugin[options].apply(this, emptyArray.slice.call(arguments, 1)) : $(this).each(function () {
				plugin.init.call(plugin.destroy.call(this).data(name, $.extend({}, defaults, options)));
			});
		};
		$[name] = $.extend(function (index, value) {
			return extend(defaults, index, value);
		}, {
		add: function (index, value) {
			return extend(validate, index, value);
		},
		extend: function (index, value) {
			return extend(plugin, index, value);
		},
		version: '2.0.0'
	});
})(jQuery);
