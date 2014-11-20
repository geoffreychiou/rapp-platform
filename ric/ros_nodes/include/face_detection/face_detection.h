#ifndef RAPP_FACE_DETECTION_NODE
#define RAPP_FACE_DETECTION_NODE

#include <iostream>
#include "ros/ros.h"

#include <rapp_platform_ros_communications/FaceDetectionRosSrv.h>

class FaceDetection
{
  public:

    // Default constructor
    FaceDetection(void);

    bool faceDetectionCallback(
      rapp_platform_ros_communications::FaceDetectionRosSrv::Request& req,
      rapp_platform_ros_communications::FaceDetectionRosSrv::Response& res
      );
    
  private:
    // The ROS node handle
    ros::NodeHandle nh_;

    // The service server 
    ros::ServiceServer faceDetectionService_;
    
    // Topic nomeclarure
    std::string faceDetectionTopic_;    
};

#endif