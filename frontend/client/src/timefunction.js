 var getTimeStamp = (selectedValue) =>{
    var date = new Date()

    if(selectedValue === 1){
      date = addMonths(date = new Date(),1)

      return date
    }
    if(selectedValue === 3){
      date = addMonths(date = new Date(),3)

      return date
    }
    if(selectedValue === 6){
      date = addMonths(date = new Date(),6)

      return date
    }

    if(selectedValue === 12){
      date = addMonths(date = new Date(),12)

      return date
    }


    function addMonths(date = new Date(), months) {
      var d = date.getDate();
      date.setMonth(date.getMonth() + +months);
      if (date.getDate() !== d) {
        date.setDate(0);
      }
      return date;
    }

  }
  export {getTimeStamp}