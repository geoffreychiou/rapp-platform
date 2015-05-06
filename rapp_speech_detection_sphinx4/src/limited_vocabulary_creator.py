#!/usr/bin/env python

#MIT License (MIT)

#Copyright (c) <2014> <Rapp Project EU>

#Permission is hereby granted, free of charge, to any person obtaining a copy
#of this software and associated documentation files (the "Software"), to deal
#in the Software without restriction, including without limitation the rights
#to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
#copies of the Software, and to permit persons to whom the Software is
#furnished to do so, subject to the following conditions:

#The above copyright notice and this permission notice shall be included in
#all copies or substantial portions of the Software.

#THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
#IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
#FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
#AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
#LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
#OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
#THE SOFTWARE.

# Authors: Athanassios Kintsakis, Manos Tsardoulias
# contact: akintsakis@issel.ee.auth.gr, etsardou@iti.gr


import rospy
import sys
import os

from global_parameters import GlobalParams

class LimitedVocabularyCreator(GlobalParams):

  def __init__(self):
    GlobalParams.__init__(self)

    self.languages_package = self.language_models_url + "/tmp_language_pack/"
    
    if not os.path.exists(self.languages_package):
      os.makedirs(self.languages_package)
 
    self.sphinx_configuration = { \
      'jar_path' : ".:" + self.sphinx_jar_files_url + "/sphinx4-core-1.0-SNAPSHOT.jar:" \
            + self.sphinx_package_url + "/src", \
      'configuration_path' : self.language_models_url + "/greekPack/default.config.xml", \
      'acoustic_model' : self.acoustic_models_url, \
      'grammar_name' : '', \
      'grammar_folder' : '', \
      'dictionary' : '', \
      'language_model' : '', \
      'grammar_disabled' : True
      }


  # Creates temporary configuration files for the input limited vocabulary
  # The 'words' input argument is of the form:
  # words = {
  #           'word1_en_chars': [phonem1, phonem2,...],
  #           'word2_en_chars': [phonem1, phonem2,...]
  #           ...
  #         }
  def createConfigurationFiles(self, words, grammar, sentences):
    
    # Create custom dictionary file
    self.sphinx_configuration['dictionary'] = self.languages_package + 'custom.dict'
    custom_dict = open(self.sphinx_configuration['dictionary'], 'w')
    for word in words:
      tmp_line = word
      for phoneme in words[word]:
        tmp_line += " " + phoneme
      custom_dict.write(tmp_line + '\n')
    custom_dict.close()

    # Check grammar
    if len(grammar) == 0:
      self.sphinx_configuration['grammar_disabled'] = True
    else:
      self.sphinx_configuration['grammar_disabled'] = False
    self.sphinx_configuration['grammar_name'] = 'custom'
    self.sphinx_configuration['grammar_folder'] = self.languages_package
    custom_grammar = open(self.sphinx_configuration['grammar_folder'] +
        self.sphinx_configuration['grammar_name'] + '.gram', 'w')
    custom_grammar.write('#JSGF V1.0;\n')
    custom_grammar.write("grammar " + self.sphinx_configuration['grammar_name'] + ';\n')
    counter = 1
    for gram in grammar:
      custom_grammar.write("public <cmd" + str(counter) + ">=" + gram + ";\n")
      counter += 1
    custom_grammar.close()

    # Fix sentences / language model
    self.sphinx_configuration['language_model'] = self.languages_package + \
      "sentences.lm.dmp"
    custom_sentences = open(self.languages_package + 'sentences.txt', 'w')
    if len(sentences) != 0:
      for sent in sentences:
        custom_sentences.write("<s> " + sent + " </s>\n")
    else:
      for word in words:
        custom_sentences.write("<s> " + word + " </s>\n")
    custom_sentences.close()

    # Run script to fix the language model
    print "Sphinx: Creating language model files\n"
    bash_file = self.language_models_url + "/greekPack/run.sh"
    bash_command = "cp " + bash_file + " " + self.languages_package + \
        " && cd " + self.languages_package + " && bash run.sh"
    os.system(bash_command)

    return self.sphinx_configuration
