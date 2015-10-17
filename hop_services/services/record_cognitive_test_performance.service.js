/*!
 * @file record_cognitive_test_performace.service.js
 *
 */

/**
 *  MIT License (MIT)
 *
 *  Copyright (c) <2014> <Rapp Project EU>
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the "Software"), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 *
 *
 *  Authors: Konstantinos Panayiotou
 *  Contact: klpanagi@gmail.com
 *
 */


//"use strict";

/* ------------< Load and set basic configuration parameters >-------------*/
var __DEBUG__ = false;
var user = process.env.LOGNAME;
var module_path = '../modules/';
var config_path = '../config/';
var srvEnv = require( config_path + 'env/hop-services.json' )
var __hopServiceName = 'record_cognitive_test_performance';
var __hopServiceId = null;
var __masterId = null;
var __storeDir = '~/.hop/cache/';
/* ----------------------------------------------------------------------- */

/* --------------------------< Load required modules >---------------------*/
var RandStringGen = require ( module_path +
  'RandomStrGenerator/randStringGen.js' );
var hop = require('hop');
var RosSrvPool = require(module_path + 'ros/srvPool.js');
var RosParam = require(module_path + 'ros/rosParam.js')
/* ----------------------------------------------------------------------- */

/*-----<Defined Name of QR Node ROS service>----*/
var ros_service_name = srvEnv[__hopServiceName].ros_srv_name;
var rosParam = new RosParam({});
var rosSrvThreads = 0;

/* -------------------------< ROS service pool >-------------------------- */
var rosSrvPool = undefined;

// TODO when multithreaed is enabled on ROS-side
//rosParam.getParam_async('/rapp_qr_detection_threads', function(data){
  //if(data)
  //{
    //rosSrvThreads = data;
    //rosSrvPool = new RosSrvPool(ros_service_name, rosSrvThreads);
  //}
//});
/* ----------------------------------------------------------------------- */


/*----------------< Random String Generator configurations >---------------*/
var stringLength = 5;
var randStrGen = new RandStringGen( stringLength );
/* ----------------------------------------------------------------------- */


/* ------< Set timer values for websocket communication to rosbridge> ----- */
var timeout = srvEnv[__hopServiceName].timeout; // ms
var max_tries = srvEnv[__hopServiceName].retries;
/* ----------------------------------------------------------------------- */


register_master_interface();



/*!
 * @brief Ontology-SuperclassesOf database query, HOP Service Core.
 *
 * @param query Ontology query given in a string format
 * @return Results.
 */
service record_cognitive_test_performance( {user: '', test: '',
  testType: '', score: 0} )
{
  var startT = new Date().getTime();
  var execTime = 0;
  if(rosSrvThreads) {var rosSrvCall = rosSrvPool.getAvailable();}
  else {var rosSrvCall = ros_service_name;}
  console.log(rosSrvCall);
  postMessage( craft_slaveMaster_msg('log', 'client-request {' + rosSrvCall + '}') );

  /*----------------------------------------------------------------- */
  return hop.HTTPResponseAsync(
    function( sendResponse ) {

      var args = {
        username: user,
        test:     test,
        testType: testType,
        score:    parseInt(score)
      };

      var respFlag = false;
      var wsError = false;
      // Create a unique caller id
      var unqCallId = randStrGen.createUnique();
      var rosbridge_msg = craft_rosbridge_msg(args, rosSrvCall, unqCallId);

      /**
       * ---- Catch exception on initiating websocket.
       *  -- Return to client immediately on exception thrown.
       */
      try{
        var rosWS = new WebSocket('ws://localhost:9090');
        // Register WebSocket.onopen callback
        rosWS.onopen = function(){
          var logMsg = 'Connection to rosbridge established';
          postMessage( craft_slaveMaster_msg('log', logMsg) );
          this.send(JSON.stringify(rosbridge_msg));
        }
        // Register WebSocket.onclose callback
        rosWS.onclose = function(){
          var logMsg = 'Connection to rosbridge closed';
          postMessage( craft_slaveMaster_msg('log', logMsg) );
        }
        // Register WebSocket.onmessage callback
        rosWS.onmessage = function(event){
          if(rosSrvThreads) {rosSrvPool.release(rosSrvCall);}
          var logMsg = 'Received message from rosbridge';
          postMessage( craft_slaveMaster_msg('log', logMsg) );

          respFlag = true; // Raise Response-Received Flag

          this.close(); // Close websocket
          rosWS = undefined; // Ensure deletion of websocket

          // Dismiss the unique call identity key for current client.
          randStrGen.removeCached( unqCallId );
          execTime = new Date().getTime() - startT;
          postMessage( craft_slaveMaster_msg('execTime', execTime) );
          var response = craft_response(event.value);
          sendResponse( hop.HTTPResponseJson(response));
        }
        // Register WebSocket.onerror callback
        rosWS.onerror = function(e){
          if(rosSrvThreads) {rosSrvPool.release(rosSrvCall);}
          rosWS = undefined;
          wsError = true;

          var logMsg = 'Websocket' +
            'to rosbridge [ws//localhost:9090] got error...\r\n' + e;
          postMessage( craft_slaveMaster_msg('log', logMsg) );

          var response = craft_error_response();
          sendResponse( hop.HTTPResponseJson(response));
          execTime = new Date().getTime() - startT;
          postMessage( craft_slaveMaster_msg('execTime', execTime) );
        }
      }
      catch(e){
        if(rosSrvThreads) {rosSrvPool.release(rosSrvCall);}
        if(rosWS){ rosWS.close()}
        rosWS = undefined;
        wsError = true;

        var logMsg = 'ERROR: Cannot open websocket' +
          'to rosbridge [ws//localhost:9090]\r\n' + e;
        postMessage( craft_slaveMaster_msg('log', logMsg) );

        var response = craft_error_response();
        sendResponse( hop.HTTPResponseJson(response));
        execTime = new Date().getTime() - startT;
        postMessage( craft_slaveMaster_msg('execTime', execTime) );
        return;
      }
      /*------------------------------------------------------------------ */

      var retries = 0;

      // Set Timeout wrapping function
      function asyncWrap(){
        setTimeout( function(){

         if (respFlag || wsError) { return; }
         else{
           retries += 1;

           var logMsg = 'Reached rosbridge response timeout' +
             '---> [' + timeout.toString() + '] ms ... Reconnecting to rosbridge.' +
             'Retry-' + retries;
           postMessage( craft_slaveMaster_msg('log', logMsg) );

           /* - Fail to receive message from rosbridge. Return to client */
           if (retries >= max_tries)
           {
             if(rosSrvThreads) {rosSrvPool.release(rosSrvCall);}
             var logMsg = 'Reached max_retries [' + max_tries + ']' +
               ' Could not receive response from rosbridge...';
             postMessage( craft_slaveMaster_msg('log', logMsg) );


             rosWS.close();
             rosWS = undefined;
             //  Close websocket before return
             execTime = new Date().getTime() - startT;
             postMessage( craft_slaveMaster_msg('execTime', execTime) );
             var response = craft_error_response();
             sendResponse( hop.HTTPResponseJson(response));
             return;
           }

           if (rosWS != undefined) { rosWS.close(); }
           rosWS = undefined;

           /* --------------< Re-open connection to the WebSocket >--------------*/
           try{
             rosWS = new WebSocket('ws://localhost:9090');

             /* -----------< Redefine WebSocket callbacks >----------- */
             rosWS.onopen = function(){
               var logMsg = 'Connection to rosbridge established';
               postMessage( craft_slaveMaster_msg('log', logMsg) );
               this.send(JSON.stringify(rosbridge_msg));
             }

             rosWS.onclose = function(){
               var logMsg = 'Connection to rosbridge closed';
               postMessage( craft_slaveMaster_msg('log', logMsg) );
             }

             rosWS.onmessage = function(event){
               if(rosSrvThreads) {rosSrvPool.release(rosSrvCall);}
               var logMsg = 'Received message from rosbridge';
               postMessage( craft_slaveMaster_msg('log', logMsg) );

               //Remove the uniqueID so it can be reused
               randStrGen.removeCached( unqCallId );

               respFlag = true;
               execTime = new Date().getTime() - startT;
               postMessage( craft_slaveMaster_msg('execTime', execTime) );
               var response = craft_response(event.value);
               sendResponse( hop.HTTPResponseJson(response));
               this.close(); // Close websocket
               rosWS = undefined; // Decostruct websocket
             }
             // Register WebSocket.onerror callback
             rosWS.onerror = function(e){
               if(rosSrvThreads) {rosSrvPool.release(rosSrvCall);}
               rosWS = undefined;
               wsError = true;

               var logMsg = 'Websocket' +
                 'to rosbridge [ws//localhost:9090] got error...\r\n' + e;
               postMessage( craft_slaveMaster_msg('log', logMsg) );

               var response = craft_error_response();
               sendResponse( hop.HTTPResponseJson(response));
               execTime = new Date().getTime() - startT;
               postMessage( craft_slaveMaster_msg('execTime', execTime) );
             }

           }
           catch(e){
             if(rosSrvThreads) {rosSrvPool.release(rosSrvCall);}
             if(rosWS){ rosWS.close()}
             rosWS = undefined;
             wsError = true;

             var logMsg = 'ERROR: Cannot open websocket' +
               'to rosbridge --> [ws//localhost:9090]';
             postMessage( craft_slaveMaster_msg('log', logMsg) );

             execTime = new Date().getTime() - startT;
             postMessage( craft_slaveMaster_msg('execTime', execTime) );
             var response = craft_error_response();
             sendResponse( hop.HTTPResponseJson(response));
             return;
           }

         }
         /*--------------------------------------------------------*/
         asyncWrap(); // Recall timeout function

       }, timeout); //Timeout value is set at 100 ms.
     }
     asyncWrap();
/*============================================================================*/
   }, this );
};



/*!
 * @brief Crafts the form/format for the message to be returned to client
 * @param rosbridge_msg Return message from rosbridge
 * @return Message to be returned from service
 */
function craft_response(rosbridge_msg)
{
  var msg = JSON.parse(rosbridge_msg);
  var performance_entry = msg.values.userCognitiveTestPerformanceEntry;
  var trace = msg.values.trace;
  var success = msg.values.success;
  var error = msg.values.error;
  var call_result = msg.result;
  //console.log(msg)

  var response = {performance_entry: '', error: ''};
  var logMsg = '';

  if (call_result)
  {
    logMsg = 'Returning to client.';
    response.performance_entry = performance_entry;

    if ( ! success )
    {
      logMsg += ' ROS service [' + ros_service_name + '] error'
        ' ---> ' + error;
      response.error = (!error && trace.length) ?
        trace[trace.length - 1] : error;
    }
    else
    {
      logMsg += ' ROS service [' + ros_service_name + '] returned with success'
    }
  }
  else
  {
    logMsg = 'Communication with ROS service ' + ros_service_name +
      'failed. Unsuccesful call! Returning to client with error' +
      ' ---> RAPP Platform Failure';
    response.error = 'RAPP Platform Failure';
  }

  //console.log(response);
  postMessage( craft_slaveMaster_msg('log', logMsg) );
  return response;
}

/*!
 * @brief Crafts response message on Platform Failure
 */
function craft_error_response()
{
  var errorMsg = 'RAPP Platform Failure!';
  var response = {performance_entry: '', error: errorMsg};

  var logMsg = 'Return to client with error --> ' + errorMsg;
  postMessage( craft_slaveMaster_msg('log', logMsg) );

  return response;
}


/*!
 * @brief Crafts ready to send, rosbridge message.
 *   Can be used by any service!!!!
 */
function craft_rosbridge_msg(args, service_name, id){

  var rosbrige_msg = {
    'op': 'call_service',
    'service': service_name,
    'args': args,
    'id': id
  };

  return rosbrige_msg;
}


function register_master_interface()
{
  // Register onexit callback function
  onexit = function(e){
    console.log("Service [%s] exiting...", __hopServiceName);
    var logMsg = "Received termination command. Exiting.";
    postMessage( craft_slaveMaster_msg('log', logMsg) );
  }

  // Register onmessage callback function
  onmessage = function(msg){
    if (__DEBUG__)
    {
      console.log("Service [%s] received message from master process",
        __hopServiceName);
      console.log("Msg -->", msg.data);
    };

    var logMsg = 'Received message from master process --> [' +
      msg.data + ']';
    postMessage( craft_slaveMaster_msg('log', logMsg) );

    exec_master_command(msg.data);
  }

  // On initialization inform master and append to log file
  var logMsg = "Initiated worker";
  postMessage( craft_slaveMaster_msg('log', logMsg) );
}


function exec_master_command(msg)
{
  var cmd = msg.cmdId;
  var data = msg.data;
  switch (cmd)
  {
    case 2055:  // Set worker ID
      __hopServiceId = data;
      break;
    case 2050:
      __masterId = data;
      break;
    default:
      break;
  }
}


function craft_slaveMaster_msg(msgId, msg)
{
  var msg = {
    name: __hopServiceName,
    id:   __hopServiceId,
    msgId: msgId,
    data: msg
  }
  return msg;
}